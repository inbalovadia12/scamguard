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

function enforceConsistency(score: number, risk: string, evidence?: { scam: number; spam: number; suspicious: number; safe: number; verified: boolean }): { score: number; risk: 'low' | 'medium' | 'high' } {
  let s = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 0;
  const e = evidence || { scam: 0, spam: 0, suspicious: 0, safe: 0, verified: false };
  // reputation_score is the legacy field name for Vardin's single numeric RISK score: higher = more dangerous.
  if (e.verified) s = Math.min(s || 10, 30);
  else if (e.scam > 0) s = Math.max(75, s);
  else if (e.spam > 0 && e.suspicious === 0) s = Math.max(50, Math.min(s, 60));
  else if (e.suspicious > 0) s = Math.max(41, Math.min(s, 70));
  else if (s === 0 && e.safe > 0) s = 10;
  let r: 'low' | 'medium' | 'high';
  if (s >= 71 || e.scam > 0) r = 'high';
  else if (s >= 41 || e.spam > 0 || e.suspicious > 0) r = 'medium';
  else r = 'low';
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
  const hasSources = Array.isArray(result.sources) && result.sources.length > 0;
  // Do not promote a business name into a verified identity merely because the
  // LLM returned a source URL. Caller-report pages can mention businesses too.
  // The research model must explicitly verify the exact number on an official
  // or verified business source.
  if (result.verified_business && !hasSources) {
    result.verified_business = false;
    result.business_name = '';
  }
  const VAGUE_SUMMARY = /insufficient evidence|no (?:verified )?community reports|no reports found|no scam reports found/i;
  if (result.verified_business && realBusiness && VAGUE_SUMMARY.test(result.summary || '')) {
    result.summary = `This number belongs to ${bn}. No scam reports were found for this number.`;
  }
  if (result.verified_business) {
    result.reputation_score = 10;
    result.risk_level = 'low';
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

// Phone country calling-code table. Used to detect a number's country from its
// dialing-code prefix and to normalize local-format numbers using the selected
// country's trunk rules. `stripLeadingZero` indicates that local dialing uses a
// leading 0 trunk prefix which is dropped in international format (Italy keeps
// its 0; US/Canada have no trunk 0).
const PHONE_COUNTRY_TABLE: { code: string; country: string; stripLeadingZero: boolean }[] = [
  { code: '1', country: 'United States', stripLeadingZero: false },
  { code: '1', country: 'Canada', stripLeadingZero: false },
  { code: '7', country: 'Russia', stripLeadingZero: true },
  { code: '20', country: 'Egypt', stripLeadingZero: true },
  { code: '27', country: 'South Africa', stripLeadingZero: true },
  { code: '30', country: 'Greece', stripLeadingZero: true },
  { code: '31', country: 'Netherlands', stripLeadingZero: true },
  { code: '32', country: 'Belgium', stripLeadingZero: true },
  { code: '33', country: 'France', stripLeadingZero: true },
  { code: '34', country: 'Spain', stripLeadingZero: true },
  { code: '36', country: 'Hungary', stripLeadingZero: true },
  { code: '39', country: 'Italy', stripLeadingZero: false },
  { code: '40', country: 'Romania', stripLeadingZero: true },
  { code: '41', country: 'Switzerland', stripLeadingZero: true },
  { code: '43', country: 'Austria', stripLeadingZero: true },
  { code: '44', country: 'United Kingdom', stripLeadingZero: true },
  { code: '45', country: 'Denmark', stripLeadingZero: false },
  { code: '46', country: 'Sweden', stripLeadingZero: true },
  { code: '47', country: 'Norway', stripLeadingZero: false },
  { code: '48', country: 'Poland', stripLeadingZero: true },
  { code: '49', country: 'Germany', stripLeadingZero: true },
  { code: '51', country: 'Peru', stripLeadingZero: true },
  { code: '52', country: 'Mexico', stripLeadingZero: true },
  { code: '53', country: 'Cuba', stripLeadingZero: true },
  { code: '54', country: 'Argentina', stripLeadingZero: true },
  { code: '55', country: 'Brazil', stripLeadingZero: true },
  { code: '56', country: 'Chile', stripLeadingZero: true },
  { code: '57', country: 'Colombia', stripLeadingZero: true },
  { code: '58', country: 'Venezuela', stripLeadingZero: true },
  { code: '60', country: 'Malaysia', stripLeadingZero: true },
  { code: '61', country: 'Australia', stripLeadingZero: true },
  { code: '62', country: 'Indonesia', stripLeadingZero: true },
  { code: '63', country: 'Philippines', stripLeadingZero: true },
  { code: '64', country: 'New Zealand', stripLeadingZero: true },
  { code: '65', country: 'Singapore', stripLeadingZero: false },
  { code: '66', country: 'Thailand', stripLeadingZero: true },
  { code: '81', country: 'Japan', stripLeadingZero: true },
  { code: '82', country: 'South Korea', stripLeadingZero: true },
  { code: '84', country: 'Vietnam', stripLeadingZero: true },
  { code: '86', country: 'China', stripLeadingZero: true },
  { code: '90', country: 'Turkey', stripLeadingZero: true },
  { code: '91', country: 'India', stripLeadingZero: true },
  { code: '92', country: 'Pakistan', stripLeadingZero: true },
  { code: '94', country: 'Sri Lanka', stripLeadingZero: true },
  { code: '95', country: 'Myanmar', stripLeadingZero: true },
  { code: '98', country: 'Iran', stripLeadingZero: true },
  { code: '212', country: 'Morocco', stripLeadingZero: true },
  { code: '213', country: 'Algeria', stripLeadingZero: true },
  { code: '216', country: 'Tunisia', stripLeadingZero: true },
  { code: '234', country: 'Nigeria', stripLeadingZero: true },
  { code: '254', country: 'Kenya', stripLeadingZero: true },
  { code: '255', country: 'Tanzania', stripLeadingZero: true },
  { code: '256', country: 'Uganda', stripLeadingZero: true },
  { code: '260', country: 'Zambia', stripLeadingZero: true },
  { code: '263', country: 'Zimbabwe', stripLeadingZero: true },
  { code: '351', country: 'Portugal', stripLeadingZero: true },
  { code: '353', country: 'Ireland', stripLeadingZero: true },
  { code: '358', country: 'Finland', stripLeadingZero: true },
  { code: '370', country: 'Lithuania', stripLeadingZero: true },
  { code: '371', country: 'Latvia', stripLeadingZero: true },
  { code: '372', country: 'Estonia', stripLeadingZero: true },
  { code: '375', country: 'Belarus', stripLeadingZero: true },
  { code: '380', country: 'Ukraine', stripLeadingZero: true },
  { code: '385', country: 'Croatia', stripLeadingZero: true },
  { code: '386', country: 'Slovenia', stripLeadingZero: true },
  { code: '420', country: 'Czech Republic', stripLeadingZero: true },
  { code: '421', country: 'Slovakia', stripLeadingZero: true },
  { code: '505', country: 'Nicaragua', stripLeadingZero: true },
  { code: '506', country: 'Costa Rica', stripLeadingZero: true },
  { code: '507', country: 'Panama', stripLeadingZero: true },
  { code: '595', country: 'Paraguay', stripLeadingZero: true },
  { code: '598', country: 'Uruguay', stripLeadingZero: true },
  { code: '880', country: 'Bangladesh', stripLeadingZero: true },
  { code: '886', country: 'Taiwan', stripLeadingZero: true },
  { code: '961', country: 'Lebanon', stripLeadingZero: true },
  { code: '962', country: 'Jordan', stripLeadingZero: true },
  { code: '965', country: 'Kuwait', stripLeadingZero: true },
  { code: '966', country: 'Saudi Arabia', stripLeadingZero: true },
  { code: '968', country: 'Oman', stripLeadingZero: true },
  { code: '971', country: 'United Arab Emirates', stripLeadingZero: true },
  { code: '974', country: 'Qatar', stripLeadingZero: true },
  { code: '972', country: 'Israel', stripLeadingZero: true },
];

function matchCountryCode(digits: string) {
  const sorted = PHONE_COUNTRY_TABLE.slice().sort((a, b) => b.code.length - a.code.length);
  for (const e of sorted) {
    if (digits.startsWith(e.code)) return e;
  }
  return null;
}

// Normalize any user-entered phone number into a canonical E.164 cache key plus
// a human-readable display format and the resolved country. When the user
// included an explicit international prefix (+ or 00), the number's own
// dialing code is authoritative and overrides the location selector; otherwise
// we use the selected country's dialing code and trunk-prefix rules. This
// prevents international numbers (e.g. +44 7407 394404) from being mangled into
// a fake US NANP number.
function normalizePhoneNumber(input: string, countryHint: string): { cacheKey: string; displayFormat: string; country: string } {
  const raw = (input || '').trim();
  let digits = raw.replace(/[^\d]/g, '');
  let explicitIntl = raw.startsWith('+');
  if (!explicitIntl && digits.startsWith('00')) { digits = digits.slice(2); explicitIntl = true; }

  const fmtDisplay = (cc: string, national: string) => {
    if (cc === '1' && national.length === 10) {
      return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
    }
    return `+${cc} ${national}`.trim();
  };

  // Explicit international prefix: the number's own dialing code wins.
  if (explicitIntl && digits.length > 0) {
    const found = matchCountryCode(digits);
    if (found) {
      const national = digits.slice(found.code.length);
      return { cacheKey: `+${found.code}${national}`, displayFormat: fmtDisplay(found.code, national), country: found.country };
    }
    // Unrecognized country code — keep the exact digits so we still research
    // the exact number the user entered.
    return { cacheKey: `+${digits}`, displayFormat: `+${digits}`, country: countryHint || 'United States' };
  }

  // Local format: derive the dialing code from the selected country and apply
  // its trunk rules. Accept "City, Country" hint strings from geolocation.
  const hintCountry = countryHint.split(',').pop().trim();
  const hintEntry = PHONE_COUNTRY_TABLE.find((e) => e.country.toLowerCase() === hintCountry.toLowerCase());
  if (hintEntry) {
    let national = digits;
    if (hintEntry.stripLeadingZero && national.startsWith('0')) national = national.slice(1);
    return { cacheKey: `+${hintEntry.code}${national}`, displayFormat: fmtDisplay(hintEntry.code, national), country: hintEntry.country };
  }

  // Fallback: NANP 10-digit logic (preserves prior behavior for US/Canada).
  let tenDigit: string;
  if (digits.length === 10) tenDigit = digits;
  else if (digits.length === 11 && digits.startsWith('1')) tenDigit = digits.slice(1);
  else if (digits.length > 10) tenDigit = digits.slice(-10);
  else tenDigit = digits;
  const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
  return {
    cacheKey: isValidNANP ? `+1${tenDigit}` : `+${digits}`,
    displayFormat: isValidNANP ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}` : raw,
    country: isValidNANP ? 'United States' : (countryHint || 'United States'),
  };
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

    const rawDigits = phone_number.trim().replace(/[^\d]/g, '');
    if (rawDigits.length < 7) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    // Country-aware normalization. The number's own dialing-code prefix (when
    // the user included one via + or 00) is authoritative and overrides the
    // location selector; for local-format numbers we fall back to the selected
    // country and its trunk rules. This keeps international numbers (e.g.
    // +44 7407 394404) intact instead of mangling them into a fake US number.
    const norm = normalizePhoneNumber(phone_number, countryHint);
    const cacheKey = norm.cacheKey;
    const displayFormat = norm.displayFormat;
    const effectiveCountry = norm.country;
    const canonicalDigits = cacheKey.replace(/^\+/, '');
    const matchedCountry = matchCountryCode(canonicalDigits);
    const nationalDigits = matchedCountry
      ? (matchedCountry.stripLeadingZero ? `0${canonicalDigits.slice(matchedCountry.code.length)}` : canonicalDigits.slice(matchedCountry.code.length))
      : '';
    // Search canonical E.164 plus published international, digits-only, and national forms.
    const searchVariants = [...new Set([cacheKey, displayFormat, canonicalDigits, nationalDigits, rawDigits].filter(Boolean))];

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
      // Never cache an empty/UNKNOWN research result. A missed web result is exactly what this lookup must recover from.
      const MIN_RECHECK_MS = 0;
      const r = cached[0];
      const ageMs = r?.last_external_check_at ? Date.now() - new Date(r.last_external_check_at).getTime() : Infinity;
      const hasClassification = !!r?.caller_id_status && r.caller_id_status !== 'UNKNOWN';
      const hasEvidence = (r?.scam_report_count || 0) > 0 || (r?.spam_report_count || 0) > 0 || (r?.suspicious_report_count || 0) > 0 || (r?.safe_report_count || 0) > 0 || !!r?.verified_business;
      const isInformative = hasClassification || hasEvidence;
      // The E.164 cache key is globally unique, so the same number always maps
      // to the same research regardless of the user's selected country.
      // Every explicit phone scan must revalidate live evidence. A previous LLM
      // miss or misclassification must not be served unchanged for seven days.
      const serveCache = false;
      if (serveCache) {
        const communityEvidence = await fetchCommunityEvidence();
        const redditEvidence = await fetchRedditEvidence();
        
        const creditsRemaining = await chargeCredits();
        const result = {
          country: r.country || effectiveCountry,
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
        // Re-run the canonical score/risk derivation after merging fresh evidence.
        // Cached records must obey the same single-score contract as fresh lookups.
        const cachedEvidence = {
          scam: Number(result.scam_report_count) || 0,
          spam: Number(result.spam_report_count) || 0,
          suspicious: Number(result.suspicious_report_count) || 0,
          safe: Number(result.safe_report_count) || 0,
          verified: !!result.verified_business,
        };
        const cachedConsistency = enforceConsistency(result.reputation_score ?? 0, result.risk_level || 'low', cachedEvidence);
        result.reputation_score = cachedConsistency.score;
        result.risk_level = cachedConsistency.risk;
        result.caller_id_status = statusFromReputation(result);
        result.confidence_score = computeConfidence(result);
        result.caller_id_label = computeLabel(result.caller_id_status, DEFAULT_CONFIG);
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true },
          detected_country: effectiveCountry,
          cached: true,
          credits_used: CREDIT_COST,
          credits_remaining: creditsRemaining,
          credits_limit: getMonthlyCreditLimit(user),
        });
      }
    } catch {}

    // ---- Quick check for known fictional numbers (instant) ----
    const knownFictional = checkKnownFictional(rawDigits);
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
        detected_country: effectiveCountry,
        cached: false,
        credits_used: CREDIT_COST,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
      });
    }

    // ---- LLM web search (only for unknown numbers) ----
    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `Research the phone number ${displayFormat} across the web. This is an exact-number reputation lookup, not a general country lookup.

MANDATORY EXACT SEARCH TARGETS:
- Canonical: ${cacheKey}
- International spaced: ${displayFormat}
${searchVariants.map((v) => `- ${v}`).join('\n')}

You MUST search the exact digits in each useful representation above. Never add a country name, city, area code explanation, or other words to the phone number itself when doing the exact-number search. After exact searches, use targeted searches with the exact number plus terms such as scam, fraud, spam, phishing, dangerous, robocall, complaint, review, who called.

MANDATORY SOURCE CHECKS:
1. Search exact-number results on caller-report/community sites such as Who Called Me / WhoCallsMe, 800notes, CallerSmart, Truecaller and similar services when available.
2. Search exact-number results on security and threat-intelligence sites, including Malwarebytes Scam Number Check, Gridinsoft, Kaspersky and similar sources when available.
3. Search Reddit and other public forums for the exact number.
4. Search news, government/fraud warnings, and official business/contact pages for the exact number.

IMPORTANT ABOUT MALWAREBYTES:
If the Malwarebytes Scam Number Check web page is accessible, check the exact number there and use its result as evidence. Do not claim Malwarebytes found anything unless you actually saw a result for THIS EXACT number. If the page is unavailable or its result cannot be retrieved, simply omit it and continue with other sources.

EXACT MATCH RULE:
Only count a source when the phone number on that source matches THIS EXACT number digit-for-digit. Different numbers, prefixes, area codes, nearby numbers, or generic articles do not count. Normalize punctuation and spaces only for comparison. An exact number appearing on a security blog or community complaint site is valid negative evidence even if the source is outside the number's country.

SEARCH EXECUTION:
Do not stop after the first search or after finding no result from one source. Try all exact representations and multiple source categories. If a search engine result points to a source-specific phone-number page, open that page and verify the exact number and the reported classification/comments before counting it.

Step 1 — Identify the owner. Only set business_name when THIS EXACT number is shown on the business's own official website/contact page or a major verified directory. Do not infer an owner from area code, country, number format, or complaint-site text.

Step 2 — Determine scam/spam/suspicious/legitimate evidence from the exact-number sources you actually verified.

Do not invent data. Return the URLs of every source that actually contained evidence about THIS EXACT number. If a source was searched but did not contain the number, do not include it in sources.

reputation_score (0-100, HIGHER = more dangerous):
0-15 = no negative evidence or confirmed legitimate business
16-35 = limited/anecdotal negative evidence
36-60 = suspicious/spam
61-80 = strong scam indicators / multiple scam reports
81-100 = very strong/confirmed scam evidence

risk_level:
- low = no negative evidence or confirmed legitimate business
- medium = suspicious/spam
- high = strong scam evidence

confidence_score (0-100) = confidence in the classification based ONLY on verified exact-number evidence. If no exact-number evidence is found, keep confidence low and do not call the number safe merely because nothing was found.

verified_business = true ONLY when an official/verified source contains THIS EXACT number and its source URL is included.

summary (max 300 chars): State what exact-number evidence was actually found, naming the source(s) and type of report. If nothing was found, say that no exact-number evidence was found; do not imply the number is safe.

sources: full URLs for every source where THIS EXACT number was verified.

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

    const runPhoneResearch = async (researchPrompt: string): Promise<any> => {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: researchPrompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: RESPONSE_SCHEMA,
      });
      if (response && typeof response === 'object' && !Array.isArray(response)) return response;
      return parseJsonFromText(typeof response === 'string' ? response : (response as any)?.response || JSON.stringify(response)) || {};
    };

    let result: any = {};
    try {
      result = await runPhoneResearch(prompt);

      // Always run an independent second pass. The old implementation only did
      // this when pass #1 found zero evidence, so a plausible but incomplete first
      // result could hide stronger evidence and become the final classification.
      {
        const recoveryPrompt = `SECOND, INDEPENDENT EXACT-NUMBER RESEARCH PASS.
Number: ${cacheKey}
Display: ${displayFormat}
Digits: ${rawDigits}
Country: ${effectiveCountry}

Search the live web independently from the first pass, focusing on exact-number source pages and independent caller-report databases.

Search ALL exact representations above, then target:
Who Called Me / WhoCallsMe, Should I Answer, CallFilter, Clever Dialer, Tellows, 800notes, CallerSmart, Truecaller, Malwarebytes Scam Number Check, Gridinsoft, Reddit/public forums, official business/contact pages, and reputable directories.

Use exact-number + scam/spam/fraud/complaint/review/robocall/unsolicited queries. Open result pages and verify that the page itself contains this exact number before counting it.

Do not count similar numbers, prefixes, area codes, generic articles, or search snippets that do not show this exact number. Do not invent owners, reports, classifications, or URLs. Return only verified exact-number evidence and the supplied JSON structure.`;
        const recovery = await runPhoneResearch(recoveryPrompt);

        const mergedRecovery = { ...result };
        for (const key of ['country', 'carrier', 'summary', 'business_name']) {
          if (!mergedRecovery[key] && recovery[key]) mergedRecovery[key] = recovery[key];
        }
        for (const key of ['reputation_score', 'confidence_score']) {
          if ((Number(mergedRecovery[key]) || 0) === 0 && Number(recovery[key]) > 0) mergedRecovery[key] = recovery[key];
        }
        if (recovery.risk_level && (!mergedRecovery.risk_level || mergedRecovery.risk_level === 'low')) mergedRecovery.risk_level = recovery.risk_level;
        for (const key of ['scam_report_count', 'spam_report_count', 'suspicious_report_count', 'safe_report_count']) {
          mergedRecovery[key] = Math.max(Number(mergedRecovery[key]) || 0, Number(recovery[key]) || 0);
        }
        mergedRecovery.verified_business = !!mergedRecovery.verified_business || !!recovery.verified_business;
        mergedRecovery.user_reports = [...(Array.isArray(mergedRecovery.user_reports) ? mergedRecovery.user_reports : []), ...(Array.isArray(recovery.user_reports) ? recovery.user_reports : [])].slice(0, 6);
        mergedRecovery.scam_categories = [...new Set([...(Array.isArray(mergedRecovery.scam_categories) ? mergedRecovery.scam_categories : []), ...(Array.isArray(recovery.scam_categories) ? recovery.scam_categories : [])])];
        mergedRecovery.sources = [...new Set([...(Array.isArray(mergedRecovery.sources) ? mergedRecovery.sources : []), ...(Array.isArray(recovery.sources) ? recovery.sources : [])])];
        result = mergedRecovery;
      }
    } catch (llmError) {
      console.error('LLM web search failed', llmError);
      return Response.json({ error: 'Phone lookup service temporarily unavailable. Please try again.' }, { status: 502 });
    }
    result = normalizeBusinessResult(result);
    const rawEvidence = {
      scam: Number(result.scam_report_count) || 0,
      spam: Number(result.spam_report_count) || 0,
      suspicious: Number(result.suspicious_report_count) || 0,
      safe: Number(result.safe_report_count) || 0,
      verified: !!result.verified_business,
    };
    const { score: consistentScore, risk: consistentRisk } = enforceConsistency(result.reputation_score ?? 0, result.risk_level || 'low', rawEvidence);
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
        verified_business: !!result.verified_business,
      },
      communityEvidence,
      redditEvidence,
    );

    // Re-derive BOTH values from the final merged evidence. This makes the
    // numeric score and risk level a single canonical pair all the way to the UI.
    const mergedEvidence = {
      scam: Number(merged.scam_report_count) || 0,
      spam: Number(merged.spam_report_count) || 0,
      suspicious: Number(merged.suspicious_report_count) || 0,
      safe: Number(merged.safe_report_count) || 0,
      verified: !!merged.verified_business,
    };
    // Re-run business normalization AFTER community/Reddit evidence is merged so an
    // exact official business match can become SAFE before the final score is derived.
    normalizeBusinessResult(merged);
    const finalConsistency = enforceConsistency(merged.reputation_score ?? 0, merged.risk_level || 'low', mergedEvidence);
    merged.reputation_score = finalConsistency.score;
    merged.risk_level = finalConsistency.risk;

    const fullResult = {
      country: result.country || effectiveCountry,
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
      verified_business: !!merged.verified_business,
      business_name: merged.business_name || '',
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
      lookup_country: effectiveCountry,
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
      detected_country: effectiveCountry,
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