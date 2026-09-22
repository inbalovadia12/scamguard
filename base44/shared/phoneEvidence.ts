// Evidence-weighted phone-number scam assessment.
//
// The lookup engine must NEVER invent evidence. Reputation score, classification,
// confidence, and report counts are computed ONLY from traceable, exact-match
// stored evidence:
//   1. Official company / government numbers registry (highest weight)
//   2. Stored community reports (PhoneCommunityReport) for the EXACT number
//   3. Indexed public reports (RedditScamNumber) for the EXACT number
// The LLM is used only to identify country / carrier / business name — never to
// generate report counts, scam categories, or risk claims.

import { normalizePhoneNumber } from "./phoneReputation.ts";

// ---------------------------------------------------------------------------
// Official / verified business number registry
// ---------------------------------------------------------------------------
// Curated from each company's official contact page. Keyed by the canonical
// "+digits" form (normalizePhoneNumber). This is a general, extensible registry —
// not a per-number special case. Entries here are treated as high-trust official
// sources; they strongly reduce the scam score unless strong evidence shows the
// number is being spoofed (see computePhoneAssessment).
const OFFICIAL_NUMBERS: Record<string, { business: string; source: string }> = {
  "+18008648331": { business: "United Airlines", source: "https://www.united.com/ual/en/us/contact" },
  "+18008291040": { business: "IRS (U.S. Internal Revenue Service)", source: "https://www.irs.gov/help/telephone-assistance" },
  "+18007721213": { business: "U.S. Social Security Administration", source: "https://www.ssa.gov/agency/contact/" },
  "+18002758777": { business: "USPS (U.S. Postal Service)", source: "https://www.usps.com/help/contact-us.htm" },
  "+18002752273": { business: "Apple (AppleCare)", source: "https://support.apple.com/contact" },
  "+18882804331": { business: "Amazon Customer Service", source: "https://www.amazon.com/gp/help/customer/contact-us" },
  "+18004321000": { business: "Bank of America", source: "https://www.bankofamerica.com/customer-service/" },
  "+18009359935": { business: "Chase Bank", source: "https://www.chase.com/personal/customer-care" },
  "+18004337300": { business: "American Airlines", source: "https://www.aa.com/contact/us" },
  "+18002211212": { business: "Delta Air Lines", source: "https://www.delta.com/contactus" },
  "+18006427676": { business: "Microsoft Support", source: "https://support.microsoft.com/contactus" },
};

export interface OfficialMatch {
  matched: boolean;
  business_name: string;
  source: string;
}

export function matchOfficialNumber(normalizedNumber: any): OfficialMatch {
  const key = normalizePhoneNumber(normalizedNumber);
  if (!key) return { matched: false, business_name: "", source: "" };
  const entry = OFFICIAL_NUMBERS[key];
  if (!entry) return { matched: false, business_name: "", source: "" };
  return { matched: true, business_name: entry.business, source: entry.source };
}

// ---------------------------------------------------------------------------
// Recency + consistency helpers
// ---------------------------------------------------------------------------
const RECENT_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

function isRecent(dateish: any): boolean {
  if (!dateish) return false;
  const t = new Date(dateish).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < RECENT_MS;
}

function uniqueNonEmpty(values: any[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const s = String(v || "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export interface PhoneAssessmentInput {
  normalizedNumber: string;
  officialMatch: OfficialMatch;
  communityReports: any[]; // PhoneCommunityReport rows (already exact-match validated)
  redditReports: any[]; // RedditScamNumber rows (already exact-match validated)
  llmInfo?: { country?: string; carrier?: string; business_name?: string } | null;
}

export interface PhoneAssessment {
  reputation_score: number;
  risk_level: "low" | "medium" | "high";
  caller_id_status: "SCAM" | "SPAM" | "SUSPICIOUS" | "SAFE" | "UNKNOWN";
  confidence_score: number;
  scam_categories: string[];
  summary: string;
  sources: string[];
  verified_business: boolean;
  business_name: string;
  report_count: number;
  scam_report_count: number;
  spam_report_count: number;
  suspicious_report_count: number;
  safe_report_count: number;
  evidence: any;
}

export function computePhoneAssessment(input: PhoneAssessmentInput): PhoneAssessment {
  const { officialMatch, communityReports = [], redditReports = [], llmInfo } = input;

  const communityScam = communityReports.filter((r) => r.report_type === "scam").length;
  const communitySpam = communityReports.filter((r) => r.report_type === "spam").length;
  const communitySuspicious = communityReports.filter((r) => r.report_type === "suspicious").length;
  const communitySafe = communityReports.filter((r) => r.report_type === "safe").length;
  const communityTotal = communityReports.length;

  const redditCount = redditReports.length;

  // Independent scam indicators across traceable sources.
  const totalScamIndicators = communityScam + redditCount;
  const independentScamSources = (communityScam > 0 ? 1 : 0) + (redditCount > 0 ? 1 : 0);

  const recentReports =
    communityReports.filter((r) => isRecent(r.created_date)).length +
    redditReports.filter((r) => isRecent(r.posted_at)).length;

  // Consistency: scam categories repeated across reports.
  const scamCategories = uniqueNonEmpty([
    ...communityReports.filter((r) => r.report_type === "scam").map((r) => r.scam_category),
    ...redditReports.map((r) => r.scam_category),
  ]);

  // --- Evidence-weighted score (higher = more scam risk) ---
  let score = 0;
  if (totalScamIndicators >= 10) score = 90;
  else if (totalScamIndicators >= 5) score = 75;
  else if (totalScamIndicators >= 3) score = 60;
  else if (totalScamIndicators === 2) score = 45;
  else if (totalScamIndicators === 1) score = 30;
  else score = 0;

  if (totalScamIndicators > 0 && recentReports > 0) score = Math.min(score + 5, 95);
  if (independentScamSources >= 2 && totalScamIndicators >= 3) score = Math.min(score + 5, 95);

  // Official / verified business strongly reduces the score unless there is
  // strong evidence the official number is being impersonated / spoofed.
  if (officialMatch.matched) {
    if (totalScamIndicators === 0) score = 5;
    else if (totalScamIndicators === 1) score = 12; // insufficient evidence vs. an official number
    else if (totalScamIndicators <= 4) score = 35; // possible spoofing — caution, not confirmed
    // >=5 strong evidence keeps a high score (spoofing likely)
  }

  // HARD RULE: a single report can never produce a high score.
  if (totalScamIndicators <= 1) score = Math.min(score, 30);
  if (totalScamIndicators === 0) score = Math.min(score, officialMatch.matched ? 5 : 10);

  // --- Risk level ---
  let risk_level: "low" | "medium" | "high" = "low";
  if (score >= 71) risk_level = "high";
  else if (score >= 41) risk_level = "medium";

  // --- Caller-ID classification ---
  let caller_id_status: PhoneAssessment["caller_id_status"] = "UNKNOWN";
  if (officialMatch.matched) {
    if (totalScamIndicators >= 5) caller_id_status = "SCAM"; // official number being spoofed
    else if (totalScamIndicators >= 2) caller_id_status = "SUSPICIOUS";
    else caller_id_status = "SAFE";
  } else {
    if (totalScamIndicators >= 3) caller_id_status = "SCAM";
    else if (totalScamIndicators >= 1) caller_id_status = "SUSPICIOUS";
    else if (communitySafe > 0 && totalScamIndicators === 0) caller_id_status = "SAFE";
    else caller_id_status = "UNKNOWN";
  }

  // --- Confidence in the classification (reflects evidence quality/quantity) ---
  let confidence_score = 10;
  if (officialMatch.matched && totalScamIndicators === 0) confidence_score = 90;
  else if (totalScamIndicators >= 5) confidence_score = 90;
  else if (totalScamIndicators >= 3) confidence_score = 75;
  else if (totalScamIndicators === 2) confidence_score = 50;
  else if (totalScamIndicators === 1) confidence_score = 20; // "insufficient evidence"
  else if (officialMatch.matched) confidence_score = 85;
  else if (communitySafe > 0) confidence_score = 55;
  else confidence_score = 10;

  // --- Traceable sources (only exact-match stored report URLs) ---
  const sources = uniqueNonEmpty([
    ...redditReports.map((r) => r.post_url).filter(Boolean),
    ...communityReports.flatMap((r) => Array.isArray(r.sources) ? r.sources : []),
  ]);

  // --- Evidence-based summary (never invents claims) ---
  const business = officialMatch.matched ? officialMatch.business_name : (llmInfo?.business_name || "");
  let summary = "";
  if (officialMatch.matched) {
    if (totalScamIndicators === 0) {
      summary = `Official business number found (${business}). No community or scam reports were found for this exact number.`;
    } else if (totalScamIndicators === 1) {
      summary = `Official business number found (${business}). One community report exists, but there is insufficient evidence to classify this number as a scam.`;
    } else if (totalScamIndicators <= 4) {
      summary = `Official business number found (${business}), but ${totalScamIndicators} scam reports exist for this exact number — it may be impersonated or spoofed. Verify the caller independently.`;
    } else {
      summary = `Official business number found (${business}), but multiple scam reports suggest this number is actively being spoofed. Do not trust the caller based on caller ID alone.`;
    }
  } else {
    if (totalScamIndicators === 0) {
      summary = communitySafe > 0
        ? `No scam reports found for this exact number. ${communitySafe} community report(s) mark it as safe.`
        : `No verified community reports found for this number. There is insufficient evidence to classify it.`;
    } else if (totalScamIndicators === 1) {
      summary = `One community report exists for this exact number. There is insufficient evidence to confirm a scam.`;
    } else if (totalScamIndicators === 2) {
      summary = `Two scam reports exist for this exact number across community and indexed sources. This number is suspicious but not yet confirmed.`;
    } else {
      summary = `${totalScamIndicators} scam reports across community and indexed sources indicate this number is likely associated with scams.`;
    }
  }

  return {
    reputation_score: score,
    risk_level,
    caller_id_status,
    confidence_score,
    scam_categories: scamCategories,
    summary,
    sources,
    verified_business: officialMatch.matched,
    business_name: business,
    report_count: communityTotal,
    scam_report_count: communityScam,
    spam_report_count: communitySpam,
    suspicious_report_count: communitySuspicious,
    safe_report_count: communitySafe,
    evidence: {
      official_match: officialMatch,
      total_scam_indicators: totalScamIndicators,
      independent_sources: independentScamSources,
      recent_reports: recentReports,
      community: {
        matched: communityTotal > 0,
        report_count: communityTotal,
        scam_reports: communityScam,
        spam_reports: communitySpam,
        suspicious_reports: communitySuspicious,
        safe_reports: communitySafe,
        recent: communityReports.filter((r) => isRecent(r.created_date)).length,
        reports: communityReports.map((r) => ({
          type: r.report_type,
          category: r.scam_category,
          summary: r.summary,
          created: r.created_date_label || (r.created_date ? new Date(r.created_date).toLocaleDateString() : ""),
          sources: Array.isArray(r.sources) ? r.sources : ["Vardin Community"],
        })),
      },
      reddit: {
        matched: redditCount > 0,
        report_count: redditCount,
        recent: redditReports.filter((r) => isRecent(r.posted_at)).length,
        sources: redditReports.map((r) => r.post_url).filter(Boolean),
        reports: redditReports.map((r) => ({
          title: r.title,
          summary: r.summary,
          category: r.scam_category,
          url: r.post_url,
          posted_at: r.posted_at,
        })),
      },
      assessment_basis: "stored community reports + indexed public reports + official registry (exact number match only)",
    },
  };
}