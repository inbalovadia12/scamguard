import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { waitUntil } from 'base44:runtime';
import {
  normalizePhoneNumber,
  statusFromReputation,
  computeLabel,
  computeConfidence,
  getConfig,
  upsertPhoneReputation,
  isCallerIdEntitled,
} from '../../shared/phoneReputation.ts';

// Live caller check for the native iOS caller-ID flow.
//   Fast path (instant):  canonical PhoneReputation index hit (fresh)  -> accurate, no LLM.
//   Live path (<5s):       cache miss -> quick LLM pass WITHOUT web search -> provisional answer.
//                         a deep web-research lookup runs in the background (waitUntil) and upserts
//                         the canonical index, so the NEXT check on this number is instant + accurate.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { phone_number } = body;
    const nn = normalizePhoneNumber(phone_number);
    if (!nn) return Response.json({ error: 'A valid phone number is required' }, { status: 400 });

    // Run the config fetch and the cache lookup in parallel — the fast path (known
    // number) now completes in a single round-trip instead of two sequential ones.
    const [config, existing] = await Promise.all([
      getConfig(base44),
      base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: nn }),
    ]);

    if (!isCallerIdEntitled(user, config) && user.role !== 'admin') {
      return Response.json({
        error: 'Caller identification requires a Vardin Plus or Premium plan',
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 403 });
    }
    const STALE_MS = 1000 * 60 * 60 * 24 * 30;
    const rep = existing[0];
    const fresh = rep && rep.last_external_check_at &&
      (Date.now() - new Date(rep.last_external_check_at).getTime() < STALE_MS);

    // ---- Fast path: accurate, instant ----
    if (rep && fresh) {
      const status = rep.caller_id_status || statusFromReputation(rep);
      return Response.json({
        phone_number: rep.phone_number || nn,
        normalized_number: nn,
        status,
        risk_level: rep.risk_level || 'low',
        reputation_score: rep.reputation_score || 0,
        caller_id_label: rep.caller_id_label || computeLabel(status, config),
        confidence: rep.confidence_score ?? computeConfidence(rep),
        summary: rep.summary || '',
        sources: rep.sources || [],
        country: rep.country || '',
        carrier: rep.carrier || '',
        cached: true,
        provisional: false,
      });
    }

    // ---- Live path: instant provisional answer, deep lookup runs in background ----
    // A synchronous LLM call can't reliably hit <5s, so for an uncached number we
    // return UNKNOWN immediately and enrich the canonical index in the background.
    // The next check on this number is then instant + accurate. Known scam numbers
    // are already in the cache (and in the on-device Call Directory dataset), so the
    // fast path covers the cases that matter for a ringing phone.
    const cleaned = nn.replace('+', '');
    let tenDigit: string;
    if (cleaned.length === 10) tenDigit = cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) tenDigit = cleaned.slice(1);
    else if (cleaned.length > 10) tenDigit = cleaned.slice(-10);
    else tenDigit = cleaned;
    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : (phone_number || nn);
    const intlFormat = isValidNANP ? `+1${tenDigit}` : nn;

    waitUntil(deepLookupAndUpsert(base44, nn, displayFormat, intlFormat));

    return Response.json({
      phone_number: displayFormat,
      normalized_number: nn,
      status: 'UNKNOWN',
      risk_level: 'low',
      reputation_score: 0,
      caller_id_label: computeLabel('UNKNOWN', config),
      confidence: 0,
      summary: 'No cached reputation yet — verifying this number in the background. Check again shortly.',
      sources: [],
      country: '',
      carrier: '',
      cached: false,
      provisional: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Background deep lookup: full web research against public scam/spam databases, then upsert.
async function deepLookupAndUpsert(base44: any, nn: string, displayFormat: string, intlFormat: string) {
  try {
    const prompt = `You are a phone-number reputation analyst. Research the number ${displayFormat} (international ${intlFormat}).
Rules:
- Report ONLY information SPECIFIC to THIS EXACT number regarding scam calls, spam, or robocalls.
- Only include a source URL if that page's PRIMARY topic is this number as a scam/spam caller.
- If no specific reports exist: reputation_score 5-15, risk_level "low", empty user_reports/scam_categories/sources, and say so in summary.
Check: 800notes.com, whocallsme.com, nomorobo.com, truecaller.com, reportfraud.ftc.gov, Reddit r/scams and r/phonescams (only posts whose title or body mention this exact number).
Return JSON with: country, carrier, reputation_score (0-100), risk_level (low/medium/high), user_reports[], scam_categories[], summary, sources[].`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          carrier: { type: 'string' },
          reputation_score: { type: 'number' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          user_reports: { type: 'array', items: { type: 'string' } },
          scam_categories: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['reputation_score', 'risk_level', 'summary'],
      },
    });

    await upsertPhoneReputation(base44, {
      normalized_number: nn,
      phone_number: displayFormat,
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: result.reputation_score || 0,
      risk_level: result.risk_level || 'low',
      scam_categories: result.scam_categories || [],
      summary: result.summary || '',
      sources: result.sources || [],
      last_external_check_at: new Date().toISOString(),
    });
  } catch {
    // background enrichment is best-effort; never throw after the response is sent
  }
}