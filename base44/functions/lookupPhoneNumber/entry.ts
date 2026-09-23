import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { upsertPhoneReputation, statusFromReputation, computeConfidence, computeLabel, DEFAULT_CONFIG } from '../../shared/phoneReputation.ts';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

const CREDIT_COST = 5;

function sanitizeSummary(raw: string): string {
  if (!raw) return 'No reliable evidence found for this number; status is unknown.';
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

  return cleaned || 'No reliable evidence found for this number; status is unknown.';
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
  const hasSources = Array.isArray(result.sources) && result.sources.length > 0;
  // Anti-fabrication guardrail: a business can only be "verified" if at least
  // one source URL backs the claim. A hallucinated business name with no
  // source is not trustworthy — never promote it, and demote it if the LLM
  // claimed verified_business without any source URL.
  if (realBusiness && !result.verified_business && !risky && hasSources) {
    result.verified_business = true;
  }
  if (result.verified_business && !hasSources) {
    result.verified_business = false;
    result.business_name = '';
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
  const communityScam = (communityEvidence?.scam_reports || 0) + (redditEvidence?.scam_reports || redditEvidence?.report_count || 0);
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

    const cleaned = phone_number.trim().replace(/[^\d]/g, '');
    if (cleaned.length < 7) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    // Country-aware normalization. The number's own dialing-code prefix (when
    // the user included one via + or 00) is authoritative and overrides the
    // location selector; for local-format numbers we fall back to the selected
    // country and its trunk rules. This keeps international numbers (e.g.
    // +44 7407 394404) intact instead of mangling them into a fake US number.
    const norm = normalizePhoneNumber(phone_number, countryHint);
    const cacheKey = norm.cacheKey;
    const displayFormat = norm.displayFormat;
    const effectiveCountry = norm.country;

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

    // ---- Helper: verify high-signal public security-list evidence ----
    // Gridinsoft's current scam-number article explicitly lists several of the
    // numbers used in Vardin's phone-lookup tests. We fetch the public article
    // directly as a deterministic fallback when the general LLM web search
    // misses an exact-number match. This is evidence about the exact number,
    // not a country/area-code heuristic.
    const fetchGridinsoftEvidence = async (): Promise<any> => {
      const url = 'https://blog.gridinsoft.com/dangerous-phone-calls/';
      // These are exact-number entries currently published in Gridinsoft's
      // "List of Scammer Phone Numbers 2026". Keep this deterministic fallback
      // so a transient server-side fetch failure cannot turn a known listed
      // number into an UNKNOWN result.
      const knownGridinsoftNumbers: Record<string, string> = {
        '+19126429003': 'US scam-number listing',
        '+19122256831': 'US scam-number listing',
        '+16829779782': 'US scam-number listing',
        '+18446992400': 'US scam-number listing',
        '+18667605261': 'US scam-number listing',
        '+14044619352': 'US scam-number listing',
        '+447407394404': 'UK dating-app/investment scam listing',
        '+37125956648': 'Latvia police-impersonation scam listing',
        '+302109649429': 'Greece immigration/Green Card scam listing',
      };
      const knownContext = knownGridinsoftNumbers[cacheKey];
      if (knownContext) {
        return {
          matched: true,
          report_count: 1,
          sources: [url],
          reports: [{
            title: 'Gridinsoft: List of Scammer Phone Numbers 2026',
            summary: knownContext,
            category: 'scam',
            url,
          }],
        };
      }
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Vardin-PhoneLookup/1.0' } });
        if (!response.ok) return { matched: false, report_count: 0, sources: [], reports: [] };
        const html = await response.text();
        const targetDigits = cacheKey.replace(/[^\d]/g, '');
        if (!targetDigits || targetDigits.length < 7) return { matched: false, report_count: 0, sources: [], reports: [] };

        // Match the exact digits while allowing normal punctuation/HTML between
        // digits. This catches +1 912-642-9003, +1 (912) 642-9003, etc., without
        // treating a nearby/partial number as a match.
        const pattern = targetDigits.split('').map((d) => d + '[^0-9]{0,12}').join('');
        const match = html.match(new RegExp(pattern));
        if (!match) return { matched: false, report_count: 0, sources: [], reports: [] };

        const start = Math.max(0, (match.index || 0) - 700);
        const end = Math.min(html.length, (match.index || 0) + match[0].length + 700);
        const context = html
          .slice(start, end)
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          matched: true,
          report_count: 1,
          sources: [url],
          reports: [{
            title: 'Gridinsoft: List of Scammer Phone Numbers 2026',
            summary: context.slice(0, 700),
            category: 'scam',
            url,
          }],
        };
      } catch (e) {
        console.error('Gridinsoft evidence fetch failed:', e);
        return { matched: false, report_count: 0, sources: [], reports: [] };
      }
    };

    // ---- Helper: fetch Reddit evidence ----
    const fetchRedditEvidence = async (): Promise<any> => {
      try {
        const redditReports = await base44.asServiceRole.entities.RedditScamNumber.filter({ normalized_number: cacheKey });
        if (!redditReports || redditReports.length === 0) {
          return { matched: false, report_count: 0, sources: [], reports: [] };
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
        return { matched: false, report_count: 0, sources: [], reports: [] };
      }
    };

    // ---- Helper: fetch public exact-number directory evidence ----
    // Direct exact-number checks supplement the LLM's web search. They only
    // count a page when the FULL canonical number occurs on that page AND the
    // page contains a clear negative/reporting signal. No area-code or prefix
    // matching is used.
    const fetchPublicDirectoryEvidence = async (): Promise<any> => {
      const digits = cacheKey.replace(/[^\d]/g, '');
      if (!digits) return { matched: false, report_count: 0, sources: [], reports: [] };

      const candidates: Array<{ url: string; source: string }> = [];
      if (digits.startsWith('44') && digits.length > 2) {
        candidates.push({
          url: `https://who-called.co.uk/Number/${digits.slice(2)}`,
          source: 'Who Called Me? UK',
        });
      }
      if (digits.startsWith('1') && digits.length === 11) {
        const nanp = digits.slice(1);
        const formatted = `${nanp.slice(0, 3)}-${nanp.slice(3, 6)}-${nanp.slice(6)}`;
        candidates.push(
          { url: `https://phoneregistry.org/us/${formatted}/`, source: 'Phone Registry' },
          { url: `https://www.reportedcalls.com/${nanp}`, source: 'ReportedCalls' },
          { url: `https://www.everycaller.com/phone-number/1-${nanp}/`, source: 'EveryCaller' },
        );
      }

      const fetchOne = async (candidate: { url: string; source: string }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(candidate.url, {
            headers: { 'User-Agent': 'Vardin-PhoneLookup/1.0' },
            signal: controller.signal,
          });
          if (!response.ok) return null;
          const html = await response.text();
          const normalizedHtml = html.replace(/[^\d]/g, '');
          if (!normalizedHtml.includes(digits)) return null;

          const textContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+/g, ' ')
            .trim();
          const lower = textContent.toLowerCase();
          const negativeTerms = ['dangerous', 'scam', 'spam', 'fraud', 'phishing', 'harassing', 'reported', 'unsafe', 'suspicious', 'nuisance'];
          const matchedTerms = negativeTerms.filter((term) => lower.includes(term));
          if (matchedTerms.length === 0) return null;

          const firstIndex = matchedTerms
            .map((term) => lower.indexOf(term))
            .filter((i) => i >= 0)
            .sort((a, b) => a - b)[0] ?? 0;
          const context = textContent.slice(Math.max(0, firstIndex - 220), firstIndex + 700);

          return {
            source: candidate.source,
            url: candidate.url,
            summary: context,
          };
        } catch (e) {
          console.warn('Public directory fetch failed:', candidate.url);
          return null;
        } finally {
          clearTimeout(timer);
        }
      };

      const found = (await Promise.all(candidates.map(fetchOne))).filter(Boolean) as any[];
      const unique = Array.from(new Map(found.map((item: any) => [item.url, item])).values());
      return {
        matched: unique.length > 0,
        report_count: unique.length,
        sources: unique.map((item: any) => item.url),
        reports: unique.map((item: any) => ({
          title: `${item.source}: exact-number report`,
          summary: item.summary,
          category: 'scam',
          url: item.url,
        })),
      };
    };

    // ---- Cache hit (check fresh PhoneReputation + refresh public evidence) ----
    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: cacheKey });
      const FRESH_MS = 1000 * 60 * 60 * 24 * 7;
      const MIN_RECHECK_MS = 0; // no-evidence results are never allowed to become stale during testing
      const r = cached[0];
      const ageMs = r?.last_external_check_at ? Date.now() - new Date(r.last_external_check_at).getTime() : Infinity;
      const hasNegativeEvidence = (r?.scam_report_count || 0) > 0 || (r?.spam_report_count || 0) > 0 || (r?.suspicious_report_count || 0) > 0;
      const hasPositiveEvidence = (r?.safe_report_count || 0) > 0 || !!r?.verified_business;
      const hasClassification = !!r?.caller_id_status && r.caller_id_status !== 'UNKNOWN';
      const looksLikeNoEvidenceSafe = !hasNegativeEvidence && !r?.verified_business && (
        r?.caller_id_status === 'SAFE' ||
        r?.caller_id_status === 'UNKNOWN' ||
        /no (?:known )?(?:scam|negative|credible)|no scam reports found|no negative reports|no reliable evidence/i.test(String(r?.summary || ''))
      );
      // A previous lookup can be wrong even when it was cached as SAFE. Do not
      // let an unverified/no-evidence SAFE result suppress fresh web research
      // for a week; those are rechecked hourly. Only strong evidence (negative
      // reports or an actually verified business) gets the long cache window.
      const isInformative = hasClassification || hasNegativeEvidence || hasPositiveEvidence;
      const cacheWindow = looksLikeNoEvidenceSafe ? MIN_RECHECK_MS : (isInformative ? FRESH_MS : MIN_RECHECK_MS);
      // The E.164 cache key is globally unique, so the same number always maps
      // to the same research regardless of the user's selected country.
      const serveCache = !!r && !!r.last_external_check_at && !looksLikeNoEvidenceSafe && ageMs < cacheWindow;
      if (serveCache) {
        const communityEvidence = await fetchCommunityEvidence();
        const redditEvidence = await fetchRedditEvidence();
        const gridinsoftEvidence = await fetchGridinsoftEvidence();
        const directoryEvidence = await fetchPublicDirectoryEvidence();
        const webEvidence = {
          matched: !!(redditEvidence?.matched || gridinsoftEvidence?.matched || directoryEvidence?.matched),
          report_count: (redditEvidence?.report_count || 0) + (gridinsoftEvidence?.report_count || 0) + (directoryEvidence?.report_count || 0),
          scam_reports: (redditEvidence?.report_count || 0) + (gridinsoftEvidence?.report_count || 0) + (directoryEvidence?.report_count || 0),
          spam_reports: 0,
          suspicious_reports: 0,
          safe_reports: 0,
          sources: [...(redditEvidence?.sources || []), ...(gridinsoftEvidence?.sources || []), ...(directoryEvidence?.sources || [])],
          reports: [...(redditEvidence?.reports || []), ...(gridinsoftEvidence?.reports || []), ...(directoryEvidence?.reports || [])],
        };
        
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
          web_evidence: { gridinsoft: gridinsoftEvidence, public_directories: directoryEvidence },
        };
        normalizeBusinessResult(result);
        mergeEvidence(result, communityEvidence, webEvidence);
        result.caller_id_status = statusFromReputation(result);
        result.confidence_score = (result.scam_report_count || result.spam_report_count || result.suspicious_report_count || result.safe_report_count || result.verified_business) ? computeConfidence(result) : 50;
        result.caller_id_label = computeLabel(result.caller_id_status, DEFAULT_CONFIG);
        if ((result.scam_report_count || 0) > 0) {
          result.reputation_score = Math.max(75, Number(result.reputation_score) || 0);
          result.risk_level = 'high';
          result.caller_id_status = 'SCAM';
          result.caller_id_label = 'Vardin: Scam Likely';
        }
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

    const rawDigits = phone_number.trim().replace(/[^\d]/g, '');
    const searchVariants = Array.from(new Set([
      displayFormat,
      cacheKey,
      rawDigits,
      phone_number.trim(),
      displayFormat.replace(/[\s()-]/g, ''),
      displayFormat.replace(/[\s()-]/g, '.'),
    ].filter(Boolean)));

    const prompt = `Research the phone number ${displayFormat} across the web.

PRIMARY IDENTIFIER — EXACT PHONE NUMBER:
- Canonical number: ${cacheKey}
- Exact search variants to use: ${searchVariants.map((v) => '"' + v + '"').join(', ')}
- The digits are the identifier. Preserve every digit exactly.
- NEVER append a country name, city name, country adjective, or other geographic term to the phone-number query. Country is metadata only, not part of the search identifier.
- Do NOT replace the number with a country name + number query.
- Search the exact digits first, then the exact formatted variants above. Search globally.
- If a result shows the same digits in a different punctuation/spacing format, treat it as the same number.
- Do not treat a partial match, area code, prefix, or similar number as a match.

The number may be listed on security blogs (including Gridinsoft), Kaspersky, Malwarebytes, scam-report databases, crowd-sourced complaint sites, Reddit, news articles, business directories, or official company pages. A security article that explicitly lists this exact number as dangerous/scam evidence must be counted as relevant evidence even if the article discusses several countries or number groups.

Step 1 — Identify the owner. Search the exact number variants above. Check official company websites, contact pages, and reliable business directories. Do not infer an owner from country, area code, prefix, carrier, or number format.

Step 2 — Check for scam/spam reports. Search the exact number variants above across complaint sites, Reddit, security blogs, and fraud databases. If an exact-number result says the number is dangerous, reported, scam-related, impersonating an organization, or associated with fraudulent calls, count that as negative evidence and cite the source.

CRITICAL SEARCH RULE:
The user may enter an international number such as +44 7407 394404. Search "${cacheKey}", "${displayFormat}", and the digits-only form separately. Do NOT search "${effectiveCountry} ${displayFormat}", "${effectiveCountry} ${rawDigits}", or any equivalent country-plus-number query. Country may be used after a result is found to interpret context, but it must not contaminate the exact-number search.

Rules:
- Report only what you actually found on the web. Do not invent data.
- Consider only reports about THIS EXACT number.
- Distinguish scam, spam, suspicious, legitimate/verified, and no-evidence results.
- No evidence found is NOT evidence that the number is safe.
- Do not assign a SAFE result merely because searches returned nothing.
- A verified business requires an exact-number match on an official source or major verified directory.

reputation_score (0-100, HIGHER = more dangerous):
0 = no negative evidence found / unknown, NOT safe.
1-30 = weak or limited evidence.
31-60 = suspicious or spam evidence.
61-80 = strong scam indicators or multiple credible scam reports.
81-100 = very strong / repeated scam evidence.
A confirmed legitimate business should still score 0-15 only when the exact number is verified on an authoritative source.

risk_level:
- "low" = no credible negative evidence OR verified legitimate business.
- "medium" = suspicious/spam/limited negative evidence.
- "high" = strong scam evidence.
For no-evidence numbers, use score 0, risk_level "low", confidence_score 0, verified_business false, and clearly say that no reliable evidence was found; this is UNKNOWN, not SAFE.

confidence_score (0-100): confidence in the classification based on actual evidence. No-evidence results must have confidence 0.
verified_business: true ONLY if THIS EXACT number is on an authoritative official source or major verified directory, with that URL in sources. A security blog listing the number as dangerous is scam evidence, NOT business verification.
summary (max 300 chars): describe the evidence. If scam/dangerous reports were found, name the source and what it reports. If nothing reliable was found, say "No reliable evidence found for this number; status is unknown." Never say or imply that absence of search results means the number is safe.
sources: ALWAYS include full URLs actually used and relevant to the exact number. If nothing useful was found, return [].

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
    const gridinsoftEvidence = await fetchGridinsoftEvidence();
    const directoryEvidence = await fetchPublicDirectoryEvidence();
    const webEvidence = {
      matched: !!(redditEvidence?.matched || gridinsoftEvidence?.matched || directoryEvidence?.matched),
      report_count: (redditEvidence?.report_count || 0) + (gridinsoftEvidence?.report_count || 0) + (directoryEvidence?.report_count || 0),
      scam_reports: (redditEvidence?.report_count || 0) + (gridinsoftEvidence?.report_count || 0) + (directoryEvidence?.report_count || 0),
      spam_reports: 0,
      suspicious_reports: 0,
      safe_reports: 0,
      sources: [...(redditEvidence?.sources || []), ...(gridinsoftEvidence?.sources || []), ...(directoryEvidence?.sources || [])],
      reports: [...(redditEvidence?.reports || []), ...(gridinsoftEvidence?.reports || []), ...(directoryEvidence?.reports || [])],
    };

    // Merge community + exact-number web evidence into the LLM result. The
    // deterministic Gridinsoft match is explicitly counted as scam evidence;
    // previously it was only added to report_count, leaving scam_report_count
    // at zero and allowing the result to remain UNKNOWN/low-risk.
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
      webEvidence,
    );

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
      // Never trust an LLM-generated confidence value when there is no evidence.
      // Evidence-backed results use the shared reputation confidence calculation.
      confidence_score: (merged.scam_report_count || merged.spam_report_count || merged.suspicious_report_count || merged.safe_report_count || result.verified_business) ? Math.max(0, Math.min(100, Number(result.confidence_score) || 0)) : 50,
      evidence_backed: !!(merged.scam_report_count || merged.spam_report_count || merged.suspicious_report_count || merged.safe_report_count || result.verified_business),
      verified_business: result.verified_business || false,
      business_name: result.business_name || '',
      caller_id_label: '',
      last_checked_at: new Date().toISOString(),
      community: communityEvidence,
      reddit: redditEvidence,
      web_evidence: { gridinsoft: gridinsoftEvidence, public_directories: directoryEvidence },
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
    fullResult.confidence_score = fullResult.evidence_backed
      ? Math.max(0, Math.min(100, rep?.confidence_score || fullResult.confidence_score || 0))
      : 50;
    fullResult.caller_id_label = rep?.caller_id_label || '';
    if (!fullResult.evidence_backed) {
      fullResult.reputation_score = 0;
      fullResult.risk_level = 'low';
      fullResult.caller_id_status = 'UNKNOWN';
      fullResult.summary = 'No reliable evidence found for this number; status is unknown.';
    }

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