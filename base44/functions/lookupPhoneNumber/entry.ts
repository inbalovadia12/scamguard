import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

function sanitizeSummary(raw: string): string {
  if (!raw) return 'No scam reports found for this number.';
  const withoutProcessClaims = raw.replace(
    /[^.!?]*\b(?:deeper\s+check|running\s+in\s+the\s+background|background\s+check|ongoing\s+process|further\s+analysis|still\s+checking|currently\s+(?:checking|analyzing)|will\s+(?:be\s+)?(?:check|analyz|updat)\w*)\b[^.!?]*[.!?]*/gi,
    ''
  ).trim();

  // Internet-search responses can occasionally repeat an identical finding.
  // Keep each sentence only once so a cached result never shows duplicate evidence.
  const seen = new Set<string>();
  const sentences = withoutProcessClaims.match(/[^.!?]+[.!?]?/g) || [];
  const cleaned = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const key = sentence.replace(/\s+/g, ' ').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ');

  return cleaned || 'No scam reports found for this number.';
}

function enforceConsistency(score: number, risk: string): { score: number; risk: 'low' | 'medium' | 'high' } {
  let s = score || 0;
  let r = (risk || 'low') as 'low' | 'medium' | 'high';
  if (r === 'high' && s < 71) s = 75;
  if (r === 'medium' && (s < 36 || s > 70)) s = 50;
  if (r === 'low' && s > 35) s = 15;
  return { score: s, risk: r };
}

function parseJsonFromText(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

// Quick check for known fictional/reserved number ranges
function checkKnownFictional(cleaned: string): any {
  // 555-0100 to 555-0199 are reserved
  if (cleaned.length >= 10) {
    const last4 = cleaned.slice(-4);
    const exchanges = cleaned.slice(-7, -4);
    if (exchanges === '555' && last4.startsWith('01')) {
      return {
        country: 'USA',
        carrier: 'None (Fictional Number)',
        reputation_score: 15,
        risk_level: 'low',
        confidence_score: 100,
        user_reports: [],
        scam_categories: [],
        summary: 'This number is officially reserved for fictional use. It is not assigned to a real subscriber.',
        sources: [],
        scam_report_count: 0,
        spam_report_count: 0,
        suspicious_report_count: 0,
        safe_report_count: 0,
        verified_business: false,
        business_name: '',
        community: { matched: false, report_count: 0, scam_reports: 0, spam_reports: 0, suspicious_reports: 0, safe_reports: 0, reports: [] },
        reddit: { matched: false, report_count: 0, sources: [] },
      };
    }
  }
  return null;
}

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

    const cleaned = phone_number.trim().replace(/[^\d]/g, '');
    if (cleaned.length < 7) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    let tenDigit: string;
    if (cleaned.length === 10) tenDigit = cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) tenDigit = cleaned.slice(1);
    else if (cleaned.length > 10) tenDigit = cleaned.slice(-10);
    else tenDigit = cleaned;

    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : phone_number.trim();
    const cacheKey = isValidNANP ? `+1${tenDigit}` : `+${cleaned}`;

    // ---- Helper: fetch community evidence ----
    const fetchCommunityEvidence = async (): Promise<any> => {
      try {
        const communityReports = await base44.entities.PhoneCommunityReport.filter({ normalized_number: cacheKey });
        if (!communityReports || communityReports.length === 0) {
          return { matched: false, report_count: 0, scam_reports: 0, spam_reports: 0, suspicious_reports: 0, safe_reports: 0, reports: [] };
        }

        const reports = communityReports.filter((r: any) => r.status === 'active');
        const scamCount = reports.filter((r: any) => r.report_type === 'scam').length;
        const spamCount = reports.filter((r: any) => r.report_type === 'spam').length;
        const suspiciousCount = reports.filter((r: any) => r.report_type === 'suspicious').length;
        const safeCount = reports.filter((r: any) => r.report_type === 'safe').length;

        return {
          matched: reports.length > 0,
          report_count: reports.length,
          scam_reports: scamCount,
          spam_reports: spamCount,
          suspicious_reports: suspiciousCount,
          safe_reports: safeCount,
          reports: reports.map((r: any) => ({
            type: r.report_type,
            summary: r.summary,
            category: r.scam_category,
            created: r.created_date_label,
          })),
        };
      } catch (e) {
        console.error('Community evidence fetch failed:', e);
        return { matched: false, report_count: 0, scam_reports: 0, spam_reports: 0, suspicious_reports: 0, safe_reports: 0, reports: [] };
      }
    };

    // ---- Helper: fetch Reddit evidence ----
    const fetchRedditEvidence = async (): Promise<any> => {
      try {
        const redditReports = await base44.asServiceRole.entities.RedditScamNumber.filter({ normalized_number: cacheKey });
        if (!redditReports || redditReports.length === 0) {
          return { matched: false, report_count: 0, sources: [] };
        }

        return {
          matched: redditReports.length > 0,
          report_count: redditReports.length,
          sources: redditReports.map((r: any) => r.post_url).filter(Boolean),
          reports: redditReports.map((r: any) => ({
            title: r.title,
            summary: r.summary,
            category: r.scam_category,
            url: r.post_url,
            posted_at: r.posted_at,
          })),
        };
      } catch (e) {
        console.error('Reddit evidence fetch failed:', e);
        return { matched: false, report_count: 0, sources: [] };
      }
    };

    // ---- Cache hit (check fresh PhoneReputation + fetch community/reddit evidence) ----
    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: cacheKey });
      const STALE_MS = 1000 * 60 * 60 * 24 * 30;
      const r = cached[0];
      if (r && r.last_external_check_at && (Date.now() - new Date(r.last_external_check_at).getTime() < STALE_MS)) {
        const communityEvidence = await fetchCommunityEvidence();
        const redditEvidence = await fetchRedditEvidence();
        
        const result = {
          country: r.country || '',
          carrier: r.carrier || '',
          reputation_score: r.reputation_score ?? 0,
          risk_level: r.risk_level || 'low',
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
          community: communityEvidence,
          reddit: redditEvidence,
        };
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true },
          cached: true,
        });
      }
    } catch {}

    // ---- Quick check for known fictional numbers (instant) ----
    const knownFictional = checkKnownFictional(cleaned);
    if (knownFictional) {
      const fullResult = {
        ...knownFictional,
        caller_id_status: 'UNKNOWN',
        caller_id_label: '',
        last_checked_at: new Date().toISOString(),
      };

      await upsertPhoneReputation(base44, {
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
      });

      let lookup: any = null;
      try {
        lookup = await base44.entities.PhoneLookup.create({
          phone_number: displayFormat,
          status: 'complete',
          country: fullResult.country,
          carrier: fullResult.carrier,
          reputation_score: fullResult.reputation_score,
          risk_level: fullResult.risk_level,
          user_reports: fullResult.user_reports,
          scam_categories: fullResult.scam_categories,
          summary: fullResult.summary,
          sources: fullResult.sources,
          caller_id_status: fullResult.caller_id_status,
          confidence_score: fullResult.confidence_score,
          verified_business: fullResult.verified_business,
          business_name: fullResult.business_name,
          caller_id_label: fullResult.caller_id_label,
        });
      } catch (saveError) {
        console.error('PhoneLookup save failed', saveError);
      }

      return Response.json({
        result: fullResult,
        lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false } : { phone_number: displayFormat, cached: false },
        cached: false,
      });
    }

    // ---- LLM web search (only for unknown numbers) ----
    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `Search the web for scam/spam reports on ${displayFormat}.

Rules:
- Count only reports about THIS EXACT number, not similar numbers or area codes.
- Do not invent data.
- Distinguish scam, spam, suspicious, and legitimate reports.
- High confidence (80+) for definitive cases (fictional numbers, confirmed scams, official listings).
- Lower confidence (30-60) for anecdotal reports.

Score 0-100: 0-25=confirmed scam, 26-40=strong indicators, 41-60=suspicious/spam, 61-75=limited negative, 76-100=no negatives/legitimate.
Risk level: "high" (strong scam evidence), "medium" (suspicious/spam), "low" (no negatives).

Return ONLY valid JSON:
{
  "country": "",
  "carrier": "",
  "reputation_score": 0,
  "risk_level": "low",
  "confidence_score": 0,
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

- summary: max 300 chars, what you found. No mention of future checking or background processes.
- If nothing found: all counts=0, sources=[], summary="No scam reports found for this number."

Respond in ${languageName}.`;

    let llmResponse: any = null;
    try {
      llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
      });
    } catch (llmError) {
      console.error('LLM web search failed', llmError);
      return Response.json({ error: 'Phone lookup service temporarily unavailable. Please try again.' }, { status: 502 });
    }

    const result = parseJsonFromText(typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || JSON.stringify(llmResponse)) || {};
    const { score: consistentScore, risk: consistentRisk } = enforceConsistency(result.reputation_score ?? 0, result.risk_level || 'low');
    const cleanSummary = sanitizeSummary(result.summary || '');

    // ---- Fetch community and Reddit evidence for this new lookup ----
    const communityEvidence = await fetchCommunityEvidence();
    const redditEvidence = await fetchRedditEvidence();

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
      confidence_score: Math.max(0, Math.min(100, Number(result.confidence_score) || 0)),
      verified_business: result.verified_business || false,
      business_name: result.business_name || '',
      caller_id_label: '',
      last_checked_at: new Date().toISOString(),
      community: communityEvidence,
      reddit: redditEvidence,
    };

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
    });

    fullResult.caller_id_status = rep?.caller_id_status || 'UNKNOWN';
    fullResult.confidence_score = Math.max(fullResult.confidence_score, rep?.confidence_score || 0);
    fullResult.caller_id_label = rep?.caller_id_label || '';

    let lookup: any = null;
    try {
      lookup = await base44.entities.PhoneLookup.create({
        phone_number: displayFormat,
        status: 'complete',
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
    } catch (saveError) {
      console.error('PhoneLookup save failed', saveError);
    }

    return Response.json({
      result: fullResult,
      lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false } : { phone_number: displayFormat, cached: false },
      cached: false,
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});
