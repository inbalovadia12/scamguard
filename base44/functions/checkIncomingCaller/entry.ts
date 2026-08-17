import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
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
// Fast path: read the canonical PhoneReputation index (no LLM cost).
// Live path: if no record / stale (>30d), run a web-research lookup, upsert the
// canonical index, and return the scam/not-scam classification + caller-ID label.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const config = await getConfig(base44);
    if (!isCallerIdEntitled(user, config) && user.role !== 'admin') {
      return Response.json({
        error: 'Caller identification requires a Vardin Plus or Premium plan',
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { phone_number } = body;
    const nn = normalizePhoneNumber(phone_number);
    if (!nn) return Response.json({ error: 'A valid phone number is required' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: nn });
    const STALE_MS = 1000 * 60 * 60 * 24 * 30;
    const rep = existing[0];
    const fresh = rep && rep.last_external_check_at &&
      (Date.now() - new Date(rep.last_external_check_at).getTime() < STALE_MS);

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
      });
    }

    // Live lookup against public scam/spam databases via web research.
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

    let upserted: any = null;
    try {
      upserted = await upsertPhoneReputation(base44.asServiceRole, {
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
    } catch {}

    const status = upserted?.caller_id_status || statusFromReputation(result);
    return Response.json({
      phone_number: displayFormat,
      normalized_number: nn,
      status,
      risk_level: result.risk_level || 'low',
      reputation_score: result.reputation_score || 0,
      caller_id_label: computeLabel(status, config),
      confidence: upserted?.confidence_score ?? computeConfidence(result),
      summary: result.summary || '',
      sources: result.sources || [],
      country: result.country || '',
      carrier: result.carrier || '',
      cached: false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});