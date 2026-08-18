import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { waitUntil } from 'base44:runtime';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

// Strip hallucinated "deeper check" / "background process" text from LLM summaries.
function sanitizeSummary(raw: string): string {
  if (!raw) return 'No scam reports found for this number.';
  const cleaned = raw.replace(
    /[^.!?]*\b(?:deeper\s+check|running\s+in\s+the\s+background|background\s+check|ongoing\s+process|further\s+analysis|still\s+checking|currently\s+(?:checking|analyzing)|will\s+(?:be\s+)?(?:check|analyz|updat)\w*)\b[^.!?]*[.!?]*/gi,
    ''
  ).trim();
  return cleaned || 'No scam reports found for this number.';
}

// Force score and risk_level to be consistent with each other.
function enforceConsistency(score: number, risk: string): { score: number; risk: 'low' | 'medium' | 'high' } {
  let s = score || 0;
  let r = (risk || 'low') as 'low' | 'medium' | 'high';
  if (r === 'high' && s < 71) s = 75;
  if (r === 'medium' && (s < 36 || s > 70)) s = 50;
  if (r === 'low' && s > 35) s = 15;
  return { score: s, risk: r };
}

// Parse JSON from a free-text LLM response (no response_json_schema → forces web search).
function parseJsonFromText(text: string): any {
  if (!text) return null;
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Extract the outermost JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

// Single web-search phone-number reputation lookup. Returns the full, verified
// result in one pass (~25s). Caches to the canonical PhoneReputation index
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
        const { score, risk } = enforceConsistency(r.reputation_score || 0, r.risk_level || 'low');
        const result = {
          country: r.country || '',
          carrier: r.carrier || '',
          reputation_score: score,
          risk_level: risk,
          user_reports: [],
          scam_categories: r.scam_categories || [],
          summary: sanitizeSummary(r.summary || ''),
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

    // ---- Single web-search lookup (no response_json_schema → forces actual web search) ----
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

    const prompt = `Search the web for scam and spam reports about the phone number ${displayFormat} (${intlFormat}).

Search the exact number in multiple common formats. Prioritize high-signal, relevant results — do not exhaustively investigate many websites or search unrelated pages. Only research the area code/prefix if it provides useful carrier or geographic info.

RULES:
- Only count reports that clearly refer to this exact number. Do not count similar numbers, same area code, or same prefix.
- Do not invent carrier, reports, businesses, sources, or statistics.
- Caller-ID spoofing is possible; carrier alone does not prove legitimacy.
- Give greater weight to multiple independent reports than a single unverified one.
- Distinguish scam, spam/telemarketing, suspicious, and legitimate reports.

SCORING (0 = confirmed scam, 100 = verified legitimate):
- 0-25: confirmed/repeated scam evidence
- 26-40: strong scam indicators
- 41-60: suspicious or significant spam
- 61-75: limited/unverified negative evidence
- 76-89: no credible negative evidence, not verified legitimate
- 90-100: strongly verified legitimate

risk_level must match: "high" (strong/repeated scam evidence), "medium" (suspicious/spam/limited negative), "low" (no credible negative reports or strong legitimacy evidence). "No reports found" does NOT mean confirmed safe.

Respond with ONLY a JSON object (no markdown, no backticks, no text outside JSON):

{
  "country": "",
  "carrier": "",
  "reputation_score": 0,
  "risk_level": "low",
  "user_reports": [],
  "scam_categories": [],
  "summary": "",
  "sources": [],
  "scam_report_count": 0,
  "spam_report_count": 0,
  "suspicious_report_count": 0,
  "safe_report_count": 0,
  "verified_business": false,
  "business_name": ""
}

- user_reports: up to 3 paraphrased summaries of the most relevant reports (do not directly quote users).
- sources: up to 6 URLs that contained relevant info about this exact number. No search-engine URLs. Empty array if none.
- summary: max 300 chars, what you actually found. Never mention internal processes, background checks, further analysis, or future checking.
- If no reports found, set all counts to 0, sources to empty array, summary to "No scam reports found for this number."

Respond in ${languageName}.`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
    });

    // Parse JSON from the free-text response (no response_json_schema was used)
    const result = parseJsonFromText(typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || JSON.stringify(llmResponse)) || {};

    // ---- Code-level safety nets: enforce score/risk consistency + strip hallucinated text ----
    const { score: consistentScore, risk: consistentRisk } = enforceConsistency(result.reputation_score ?? 0, result.risk_level || 'low');
    const cleanSummary = sanitizeSummary(result.summary || '');

    const fullResult = {
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: consistentScore,
      risk_level: consistentRisk,
      user_reports: Array.isArray(result.user_reports) ? result.user_reports : [],
      scam_categories: Array.isArray(result.scam_categories) ? result.scam_categories : [],
      summary: cleanSummary,
      sources: Array.isArray(result.sources) ? result.sources : [],
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

    // Persist to cache index + history in the background so the response returns immediately.
    // Store SANITIZED values so the cache never contains "deeper check" text or bad scores.
    waitUntil((async () => {
      try {
        const rep = await upsertPhoneReputation(base44, {
          normalized_number: cacheKey,
          phone_number: displayFormat,
          country: fullResult.country,
          carrier: fullResult.carrier,
          reputation_score: fullResult.reputation_score,
          risk_level: fullResult.risk_level,
          scam_categories: fullResult.scam_categories,
          summary: fullResult.summary,
          sources: fullResult.sources,
          last_external_check_at: new Date().toISOString(),
          verified_business: fullResult.verified_business,
          business_name: fullResult.business_name,
          report_counts: {
            scam: fullResult.scam_report_count,
            spam: fullResult.spam_report_count,
            suspicious: fullResult.suspicious_report_count,
            safe: fullResult.safe_report_count,
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