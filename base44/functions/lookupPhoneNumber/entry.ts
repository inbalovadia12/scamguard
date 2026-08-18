import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { waitUntil } from 'base44:runtime';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

// Single web-search phone-number reputation lookup. Returns the full, verified
// result in one pass (target <20s). Caches to the canonical PhoneReputation index
// so repeat lookups on the same number are instant.
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
          report_count: r.report_count || 0,
          scam_report_count: r.scam_report_count || 0,
          spam_report_count: r.spam_report_count || 0,
          suspicious_report_count: r.suspicious_report_count || 0,
          safe_report_count: r.safe_report_count || 0,
          caller_id_status: r.caller_id_status || 'UNKNOWN',
          confidence_score: r.confidence_score || 0,
          verified_business: r.verified_business || false,
          business_name: r.business_name || '',
          caller_id_label: r.caller_id_label || '',
          last_checked_at: r.last_checked_at || r.last_updated_at || '',
        };
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true },
          cached: true,
        });
      }
    } catch {}

    // ---- Single web-search lookup ----
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

    const prompt = `Research phone number ${displayFormat} (${intlFormat}) for scam/spam reports. Check 800notes.com, nomorobo.com, truecaller.com, Reddit r/scams for this exact number.

Score and risk_level MUST be consistent:
- low risk = reputation_score 0-35
- medium risk = reputation_score 36-70
- high risk = reputation_score 71-100

If no reports found: reputation_score 5-15, risk_level "low", summary "No scam reports found for this number."
If reports found: set risk_level and reputation_score consistently using the ranges above, plus user_reports (max 3), scam_categories, summary, sources, report counts (scam/spam/suspicious/safe).
If verified business: verified_business=true, business_name.

Respond in ${languageName}.`;

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
          scam_report_count: { type: 'number' },
          spam_report_count: { type: 'number' },
          suspicious_report_count: { type: 'number' },
          safe_report_count: { type: 'number' },
          verified_business: { type: 'boolean' },
          business_name: { type: 'string' },
        },
        required: ['reputation_score', 'risk_level', 'summary'],
      },
    });

    const fullResult = {
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: result.reputation_score || 0,
      risk_level: (result.risk_level || 'low') as 'low' | 'medium' | 'high',
      user_reports: result.user_reports || [],
      scam_categories: result.scam_categories || [],
      summary: result.summary || '',
      sources: result.sources || [],
      report_count: (result.scam_report_count || 0) + (result.spam_report_count || 0) + (result.suspicious_report_count || 0) + (result.safe_report_count || 0),
      scam_report_count: result.scam_report_count || 0,
      spam_report_count: result.spam_report_count || 0,
      suspicious_report_count: result.suspicious_report_count || 0,
      safe_report_count: result.safe_report_count || 0,
      caller_id_status: 'UNKNOWN',
      confidence_score: 0,
      verified_business: result.verified_business || false,
      business_name: result.business_name || '',
      caller_id_label: '',
      last_checked_at: new Date().toISOString(),
    };

    // Persist to cache index + history in the background so the response returns immediately
    waitUntil((async () => {
      try {
        const rep = await upsertPhoneReputation(base44, {
          normalized_number: cacheKey,
          phone_number: displayFormat,
          country: result.country || '',
          carrier: result.carrier || '',
          reputation_score: result.reputation_score || 0,
          risk_level: result.risk_level || 'low',
          scam_categories: result.scam_categories || [],
          summary: result.summary || '',
          sources: result.sources || [],
          last_external_check_at: new Date().toISOString(),
          verified_business: result.verified_business || false,
          business_name: result.business_name || '',
          report_counts: {
            scam: result.scam_report_count || 0,
            spam: result.spam_report_count || 0,
            suspicious: result.suspicious_report_count || 0,
            safe: result.safe_report_count || 0,
          },
        });

        // Reconcile derived fields from the upserted record so history matches the index
        fullResult.caller_id_status = rep?.caller_id_status || 'UNKNOWN';
        fullResult.confidence_score = rep?.confidence_score || 0;
        fullResult.caller_id_label = rep?.caller_id_label || '';

        await base44.entities.PhoneLookup.create({
          phone_number: displayFormat,
          country: fullResult.country,
          carrier: fullResult.carrier,
          reputation_score: fullResult.reputation_score,
          risk_level: fullResult.risk_level,
          user_reports: fullResult.user_reports,
          scam_categories: fullResult.scam_categories,
          summary: fullResult.summary,
          sources: fullResult.sources,
          report_count: fullResult.report_count,
          scam_report_count: fullResult.scam_report_count,
          spam_report_count: fullResult.spam_report_count,
          suspicious_report_count: fullResult.suspicious_report_count,
          safe_report_count: fullResult.safe_report_count,
          caller_id_status: fullResult.caller_id_status,
          confidence_score: fullResult.confidence_score,
          verified_business: fullResult.verified_business,
          business_name: fullResult.business_name,
          caller_id_label: fullResult.caller_id_label,
        });
      } catch {}
    })());

    return Response.json({ result: fullResult, lookup: { phone_number: displayFormat, cached: false }, cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});