import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { upsertPhoneReputation, statusFromReputation, computeConfidence, computeLabel, DEFAULT_CONFIG } from '../../shared/phoneReputation.ts';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

const CREDIT_COST = 5;

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

// The LLM is inconsistent about verified_business even when it found the business
// name. Normalize any result (fresh or cached) so a found business is consistently
// classified as a verified, SAFE number with a clear summary. A scam that happens
// to carry a business name (impersonation) is NOT promoted — the scam classification
// is preserved when there is scam/spam/suspicious evidence.
function normalizeBusinessResult(result: any): any {
  if (!result) return result;
  const bn = String(result.business_name || '').trim();
  const realBusiness = !!bn && !/^(n\/a|unknown|none|not found|null|undefined|\-)$/i.test(bn);
  const scam = result.scam_report_count || 0;
  const spam = result.spam_report_count || 0;
  const susp = result.suspicious_report_count || 0;
  const risky = scam > 0 || spam > 0 || susp > 0 || result.risk_level === 'high' || (result.reputation_score || 0) >= 41;
  if (realBusiness && !result.verified_business && !risky) {
    result.verified_business = true;
  }
  const VAGUE_SUMMARY = /insufficient evidence|no (?:verified )?community reports|no reports found|no scam reports found/i;
  if (result.verified_business && realBusiness && VAGUE_SUMMARY.test(result.summary || '')) {
    result.summary = `This number belongs to ${bn}. No scam reports were found for this number.`;
  }
  if (result.verified_business) {
    result.caller_id_status = 'SAFE';
    result.confidence_score = 100;
    result.caller_id_label = 'Vardin: Safe';
  }
  return result;
}

// Merge authoritative community + Reddit evidence into a lookup result so the
// classification reflects real reports even when the LLM's web search found
// nothing. Uses the max per category to avoid double-counting reports the LLM
// may have already seen on the same sites. Verified businesses are never
// downgraded — a Reddit "scam" report about a real business is a spoofing
// warning, not proof the business itself is a scam.
function mergeEvidence(result: any, communityEvidence: any, redditEvidence: any): any {
  if (!result) return result;
  const communityScam = (communityEvidence?.scam_reports || 0) + (redditEvidence?.report_count || 0);
  const communitySpam = communityEvidence?.spam_reports || 0;
  const communitySusp = communityEvidence?.suspicious_reports || 0;
  const communitySafe = communityEvidence?.safe_reports || 0;
  result.scam_report_count = Math.max(result.scam_report_count || 0, communityScam);
  result.spam_report_count = Math.max(result.spam_report_count || 0, communitySpam);
  result.suspicious_report_count = Math.max(result.suspicious_report_count || 0, communitySusp);
  result.safe_report_count = Math.max(result.safe_report_count || 0, communitySafe);
  result.report_count = (result.scam_report_count || 0) + (result.spam_report_count || 0) + (result.suspicious_report_count || 0) + (result.safe_report_count || 0);

  if ((result.scam_report_count || 0) > 0 && !result.verified_business) {
    if ((result.reputation_score ?? 0) < 71) { result.reputation_score = 75; result.risk_level = 'high'; }
  }

  const evidenceSources = [...(Array.isArray(result.sources) ? result.sources : []), ...(Array.isArray(redditEvidence?.sources) ? redditEvidence.sources : [])];
  const seenSrc = new Set<string>();
  result.sources = evidenceSources.filter((s: string) => { if (!s || seenSrc.has(s)) return false; seenSrc.add(s); return true; });

  if ((result.scam_report_count || 0) > 0 && /no scam reports found|no specific (?:scam|information)|yielded no specific|no negative reports/i.test(result.summary || '')) {
    const titles = (redditEvidence?.reports || []).map((r: any) => r.title).filter(Boolean).slice(0, 3);
    result.summary = titles.length > 0
      ? `Community scam reports flag this number: ${titles.join('; ')}.`
      : `${result.scam_report_count} scam report(s) from community sources flag this number.`;
  }
  return result;
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

    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
      }, { status: 402 });
    }

    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, CREDIT_COST);
      if (!usage) throw new Error('Credit balance changed during lookup. Please try again.');
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: '/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { phone_number, language, country_hint } = body;
    // Country context biases the LLM to the correct caller for the user's country
    // (the same digits can map to different businesses in different countries).
    // Defaults to the United States when left blank.
    const countryHint = (String(country_hint || '').trim()) || 'United States';

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
      const FRESH_MS = 1000 * 60 * 60 * 24 * 7;
      const MIN_RECHECK_MS = 1000 * 60 * 60; // re-run web search at most hourly for uninformative results
      const r = cached[0];
      const ageMs = r?.last_external_check_at ? Date.now() - new Date(r.last_external_check_at).getTime() : Infinity;
      const hasClassification = !!r?.caller_id_status && r.caller_id_status !== 'UNKNOWN';
      const hasEvidence = (r?.scam_report_count || 0) > 0 || (r?.spam_report_count || 0) > 0 || (r?.suspicious_report_count || 0) > 0 || (r?.safe_report_count || 0) > 0 || !!r?.verified_business;
      const isInformative = hasClassification || hasEvidence;
      const storedCountry = (String(r?.lookup_country || 'United States')).toLowerCase();
      const countryMatches = storedCountry === countryHint.toLowerCase();
      const serveCache = !!r && !!r.last_external_check_at && countryMatches && (isInformative ? ageMs < FRESH_MS : ageMs < MIN_RECHECK_MS);
      if (serveCache) {
        const communityEvidence = await fetchCommunityEvidence();
        const redditEvidence = await fetchRedditEvidence();
        
        const creditsRemaining = await chargeCredits();
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
        normalizeBusinessResult(result);
        mergeEvidence(result, communityEvidence, redditEvidence);
        result.caller_id_status = statusFromReputation(result);
        result.confidence_score = computeConfidence(result);
        result.caller_id_label = computeLabel(result.caller_id_status, DEFAULT_CONFIG);
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true },
          cached: true,
          credits_used: CREDIT_COST,
          credits_remaining: creditsRemaining,
          credits_limit: getMonthlyCreditLimit(user),
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

      const creditsRemaining = await chargeCredits();
      return Response.json({
        result: fullResult,
        lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false } : { phone_number: displayFormat, cached: false },
        cached: false,
        credits_used: CREDIT_COST,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
      });
    }

    // ---- LLM web search (only for unknown numbers) ----
    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `Research the phone number ${displayFormat} across the web.

IMPORTANT — Country context: The user is located in ${countryHint}. The same phone digits can belong to completely different businesses in different countries (for example, a number that reaches an airline in one country may reach a small business in another). Identify who THIS number belongs to WITHIN ${countryHint}: interpret the number according to ${countryHint}'s phone numbering plan, and prioritize official listings, directories, and complaint sites from ${countryHint}. If you cannot find a ${countryHint}-specific owner, say so clearly — do not substitute a business from a different country.

Step 1 — Identify the owner. Search for the business, organization, or person this number belongs to. Check official company websites, "contact us" pages, and business directories. Many numbers belong to well-known legitimate businesses (airlines, retailers, banks, utilities, government agencies) — identify them when you can.

Step 2 — Check for scam/spam reports. Search crowd-sourced complaint sites (800notes.com, whocallsme.com, callercomplaints.com), Reddit (r/ScamNumbers, r/scams), and fraud databases for reports about THIS EXACT number.

Rules:
- Report only what you actually found on the web. Do not invent data.
- Consider only reports about THIS EXACT number, not similar numbers or area codes.
- Distinguish scam, spam, suspicious, and legitimate/verified reports.

reputation_score (0-100, HIGHER = more dangerous): 0-15 = confirmed legitimate business or no negative reports; 16-35 = limited/anecdotal negative reports; 36-60 = suspicious or spam; 61-80 = strong scam indicators / multiple scam reports; 81-100 = confirmed scam number.
risk_level: "low" (no negative reports, or confirmed legitimate business), "medium" (suspicious/spam), "high" (strong scam evidence).
confidence_score (0-100): how confident you are based on the evidence found.
verified_business: true if you found this number officially listed by a known business or organization — in that case you MUST set verified_business=true AND business_name to the business's name. If you could not identify a specific business, set verified_business=false and business_name="".
summary (max 300 chars): describe what you found. If the number belongs to a known business, name it (e.g., "This is the customer service line for Target."). If you found scam reports, summarize them. If you found nothing, say "No scam reports found for this number." Never mention background checks or future processing.
sources: ALWAYS include the full URLs of the websites where you found this information (official business "contact" pages, complaint sites, Reddit posts, news articles). If you found nothing, return an empty array.

Respond in ${languageName}.`;

    const RESPONSE_SCHEMA = {
      type: 'object' as const,
      properties: {
        country: { type: 'string' },
        carrier: { type: 'string' },
        reputation_score: { type: 'number' },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        confidence_score: { type: 'number' },
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
    };

    let llmResponse: any = null;
    try {
      llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: RESPONSE_SCHEMA,
      });
    } catch (llmError) {
      console.error('LLM web search failed', llmError);
      return Response.json({ error: 'Phone lookup service temporarily unavailable. Please try again.' }, { status: 502 });
    }

    let result: any = {};
    if (llmResponse && typeof llmResponse === 'object' && !Array.isArray(llmResponse)) {
      result = llmResponse;
    } else {
      result = parseJsonFromText(typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || JSON.stringify(llmResponse)) || {};
    }
    result = normalizeBusinessResult(result);
    const { score: consistentScore, risk: consistentRisk } = enforceConsistency(result.reputation_score ?? 0, result.risk_level || 'low');
    const cleanSummary = sanitizeSummary(result.summary || '');

    // ---- Fetch community and Reddit evidence for this new lookup ----
    const communityEvidence = await fetchCommunityEvidence();
    const redditEvidence = await fetchRedditEvidence();

    // Merge authoritative community + Reddit evidence into the LLM result so the
    // classification reflects real reports even when the web search found nothing.
    const merged = mergeEvidence(
      {
        reputation_score: consistentScore,
        risk_level: consistentRisk,
        summary: cleanSummary,
        sources: Array.isArray(result.sources) ? result.sources : [],
        scam_report_count: result.scam_report_count || 0,
        spam_report_count: result.spam_report_count || 0,
        suspicious_report_count: result.suspicious_report_count || 0,
        safe_report_count: result.safe_report_count || 0,
        verified_business: result.verified_business || false,
      },
      communityEvidence,
      redditEvidence,
    );

    const fullResult = {
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: merged.reputation_score,
      risk_level: merged.risk_level,
      user_reports: Array.isArray(result.user_reports) ? result.user_reports : [],
      scam_categories: Array.isArray(result.scam_categories) ? result.scam_categories : [],
      summary: merged.summary,
      sources: merged.sources,
      report_count: merged.report_count,
      scam_report_count: merged.scam_report_count,
      spam_report_count: merged.spam_report_count,
      suspicious_report_count: merged.suspicious_report_count,
      safe_report_count: merged.safe_report_count,
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
      lookup_country: countryHint,
      report_counts: {
        scam: merged.scam_report_count,
        spam: merged.spam_report_count,
        suspicious: merged.suspicious_report_count,
        safe: merged.safe_report_count,
      },
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

    const creditsRemaining = await chargeCredits();
    return Response.json({
      result: fullResult,
      lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false } : { phone_number: displayFormat, cached: false },
      cached: false,
      credits_used: CREDIT_COST,
      credits_remaining: creditsRemaining,
      credits_limit: getMonthlyCreditLimit(user),
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});