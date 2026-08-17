import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { waitUntil } from 'base44:runtime';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

// Manual phone-number reputation lookup.
//   Fast path (instant):  canonical PhoneReputation index hit (fresh) -> accurate, no LLM.
//   First-try path (<5s): cache miss -> quick LLM pass WITHOUT web search -> provisional
//                         answer returned immediately. A deep web-research lookup runs in
//                         the background (waitUntil) and upserts the canonical index, so the
//                         NEXT lookup on this number is instant + accurate. No retry needed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { phone_number, language } = body;

    if (!phone_number || !phone_number.trim()) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cacheKey = '+' + phone_number.trim().replace(/[^\d]/g, '');

    // ---- Fast path: return the canonical reputation index if this number is already known ----
    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: cacheKey });
      const STALE_MS = 1000 * 60 * 60 * 24 * 30;
      const r = cached[0];
      if (r && r.last_external_check_at && (Date.now() - new Date(r.last_external_check_at).getTime() < STALE_MS)) {
        const result = {
          country: r.country || '',
          carrier: r.carrier || '',
          reputation_score: r.reputation_score || 0,
          risk_level: r.risk_level || 'low',
          user_reports: [],
          scam_categories: r.scam_categories || [],
          summary: r.summary || '',
          sources: r.sources || [],
        };
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true },
          cached: true,
          provisional: false,
        });
      }
    } catch {}

    // ---- First-try path: instant provisional answer, deep lookup runs in background ----
    const cleaned = phone_number.trim().replace(/[^\d]/g, '');

    let tenDigit: string;
    if (cleaned.length === 10) {
      tenDigit = cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      tenDigit = cleaned.slice(1);
    } else if (cleaned.length > 10) {
      tenDigit = cleaned.slice(-10);
    } else {
      tenDigit = cleaned;
    }

    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : phone_number.trim();
    const intlFormat = isValidNANP ? `+1${tenDigit}` : `+${cleaned}`;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    // Quick provisional pass — NO web search, so it returns in 1-3s. Gives a real,
    // useful first-try answer (country/carrier from the area code + honest baseline risk).
    const provisional = await base44.integrations.Core.InvokeLLM({
      prompt: `Phone number area-code analysis for ${displayFormat} (international ${intlFormat}).
Based ONLY on the area code / country code (no web search), respond in ${languageName} with JSON:
- country: where the number is registered (from the area/country code)
- carrier: typical carrier for that area code, or "Unknown"
- reputation_score: 5-15 if no documented high-risk pattern, 0-100 otherwise
- risk_level: "low" (0-30), "medium" (31-70), or "high" (71-100)
- user_reports: empty array (no web data available yet)
- scam_categories: empty array
- summary: one sentence in ${languageName}: "No scam reports in our index yet for this number. A deeper check is running in the background."
- sources: empty array`,
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

    const provisionalResult = {
      country: provisional.country || '',
      carrier: provisional.carrier || '',
      reputation_score: provisional.reputation_score || 5,
      risk_level: provisional.risk_level || 'low',
      user_reports: provisional.user_reports || [],
      scam_categories: provisional.scam_categories || [],
      summary: provisional.summary || 'No scam reports in our index yet for this number. A deeper check is running in the background.',
      sources: provisional.sources || [],
    };

    const saved = await base44.entities.PhoneLookup.create({
      phone_number: displayFormat,
      country: provisionalResult.country,
      carrier: provisionalResult.carrier,
      reputation_score: provisionalResult.reputation_score,
      risk_level: provisionalResult.risk_level,
      user_reports: provisionalResult.user_reports,
      scam_categories: provisionalResult.scam_categories,
      summary: provisionalResult.summary,
      sources: provisionalResult.sources,
    });

    // Deep web research runs in the background; upserts the canonical index so the
    // NEXT lookup on this number is instant + accurate. Never blocks the response.
    waitUntil(deepLookupAndUpsert(base44, cacheKey, displayFormat, intlFormat, languageName));

    return Response.json({ result: provisionalResult, lookup: saved, cached: false, provisional: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Background deep lookup: full web research against public scam/spam databases, then upsert.
async function deepLookupAndUpsert(base44: any, nn: string, displayFormat: string, intlFormat: string, languageName: string) {
  try {
    const prompt = `You are a phone number reputation analyst. Research the phone number: ${displayFormat} (international: ${intlFormat})

CRITICAL RULES — VIOLATING THESE INVALIDATES YOUR RESPONSE:
1. Report ONLY information SPECIFIC to THIS EXACT number regarding scam calls, spam, or robocalls.
2. Only include a source URL if that page's PRIMARY topic is this number as a scam/spam caller.
3. If no specific reports exist: reputation_score 5-15, risk_level "low", empty user_reports/scam_categories/sources, and say "No scam reports found for this number."

Check: 800notes.com, whocallsme.com, nomorobo.com, truecaller.com, reportfraud.ftc.gov, Reddit r/scams and r/phonescams (only posts whose title or body mention this exact number).

Return: country, carrier, reputation_score (0-100), risk_level (low/medium/high), user_reports[], scam_categories[], summary, sources[].
Respond entirely in ${languageName}.`;

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