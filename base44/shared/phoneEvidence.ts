// Evidence-weighted phone-number scam assessment.
//
// The lookup engine must NEVER invent evidence. Reputation score, classification,
// confidence, and report counts are computed ONLY from traceable, exact-match
// evidence:
//   1. Official company / government numbers registry (highest weight)
//   2. Stored community reports (PhoneCommunityReport) for the EXACT number
//   3. Indexed public reports (RedditScamNumber) for the EXACT number
//   4. Live web-search findings that EXPLICITLY mention the exact number, each
//      with a verifiable source URL (medium weight — corroboration, never the
//      sole basis for a SCAM verdict unless many distinct sources agree).
// The LLM identifies country / carrier / business and surfaces web findings;
// it never generates free-standing report counts or risk claims.

import { normalizePhoneNumber } from "./phoneReputation.ts";

// ---------------------------------------------------------------------------
// Official / verified business number registry
// ---------------------------------------------------------------------------
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
  "+18009256278": { business: "Walmart Customer Service", source: "https://www.walmart.com/help/contact-us" },
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
  webFindings?: any[]; // live web-search findings, each with a source URL mentioning the exact number
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
  const { officialMatch, communityReports = [], redditReports = [], webFindings = [], llmInfo } = input;

  const communityScam = communityReports.filter((r) => r.report_type === "scam").length;
  const communitySpam = communityReports.filter((r) => r.report_type === "spam").length;
  const communitySuspicious = communityReports.filter((r) => r.report_type === "suspicious").length;
  const communitySafe = communityReports.filter((r) => r.report_type === "safe").length;
  const communityTotal = communityReports.length;

  const redditCount = redditReports.length;
  const webCount = webFindings.length;

  // Stored reports are high-trust; web findings are medium-trust corroboration.
  const storedScamIndicators = communityScam + redditCount;
  const webScamIndicators = Math.min(webCount, 10);
  const totalScamIndicators = storedScamIndicators + webScamIndicators;
  const independentSources =
    (communityScam > 0 ? 1 : 0) + (redditCount > 0 ? 1 : 0) + (webScamIndicators > 0 ? 1 : 0);

  const recentReports =
    communityReports.filter((r) => isRecent(r.created_date)).length +
    redditReports.filter((r) => isRecent(r.posted_at)).length;

  const scamCategories = uniqueNonEmpty([
    ...communityReports.filter((r) => r.report_type === "scam").map((r) => r.scam_category),
    ...redditReports.map((r) => r.scam_category),
    ...webFindings.map((r) => r.category),
  ]);

  // --- Evidence-weighted score (higher = more scam risk) ---
  let score = 0;
  if (totalScamIndicators >= 10) score = 90;
  else if (totalScamIndicators >= 5) score = 75;
  else if (totalScamIndicators >= 3) score = 60;
  else if (totalScamIndicators === 2) score = 45;
  else if (totalScamIndicators === 1) score = 30;
  else score = 0;

  // Web-only evidence (no stored reports) is weaker and capped lower.
  if (storedScamIndicators === 0 && webScamIndicators > 0) {
    score = Math.min(score, webScamIndicators >= 4 ? 55 : webScamIndicators >= 2 ? 40 : 30);
  }

  if (totalScamIndicators > 0 && recentReports > 0) score = Math.min(score + 5, 95);
  if (independentSources >= 2 && totalScamIndicators >= 3) score = Math.min(score + 5, 95);

  // Official / verified business strongly reduces the score unless strong
  // evidence shows the official number is being impersonated / spoofed.
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
    // SCAM requires strong evidence: 3+ stored reports, OR stored + web
    // corroboration, OR 4+ distinct web sources.
    if (storedScamIndicators >= 3) caller_id_status = "SCAM";
    else if (storedScamIndicators >= 1 && webScamIndicators >= 1) caller_id_status = "SCAM";
    else if (webScamIndicators >= 4) caller_id_status = "SCAM";
    else if (totalScamIndicators >= 1) caller_id_status = "SUSPICIOUS";
    else if (communitySafe > 0 && totalScamIndicators === 0) caller_id_status = "SAFE";
    else caller_id_status = "UNKNOWN";
  }

  // --- Confidence in the classification (reflects evidence quality/quantity) ---
  let confidence_score = 10;
  if (officialMatch.matched && totalScamIndicators === 0) confidence_score = 90;
  else if (storedScamIndicators >= 5) confidence_score = 90;
  else if (storedScamIndicators >= 3) confidence_score = 75;
  else if (storedScamIndicators >= 1 && webScamIndicators >= 1) confidence_score = 70; // corroborated
  else if (webScamIndicators >= 4) confidence_score = 65;
  else if (storedScamIndicators === 2) confidence_score = 50;
  else if (totalScamIndicators === 1) confidence_score = 20; // "insufficient evidence"
  else if (officialMatch.matched) confidence_score = 85;
  else if (communitySafe > 0) confidence_score = 55;
  else confidence_score = 10;

  // --- Traceable sources (exact-match stored + web URLs) ---
  const sources = uniqueNonEmpty([
    ...redditReports.map((r) => r.post_url).filter(Boolean),
    ...communityReports.flatMap((r) => Array.isArray(r.sources) ? r.sources : []),
    ...webFindings.map((r) => r.url).filter(Boolean),
  ]);

  // --- Evidence-based summary (never invents claims) ---
  const business = officialMatch.matched ? officialMatch.business_name : (llmInfo?.business_name || "");
  let summary = "";
  if (officialMatch.matched) {
    if (totalScamIndicators === 0) {
      summary = `Official business number found (${business}). No community, indexed, or web reports were found for this exact number.`;
    } else if (totalScamIndicators === 1) {
      summary = `Official business number found (${business}). One report exists, but there is insufficient evidence to classify this number as a scam — it may be spoofed. Verify the caller independently.`;
    } else if (totalScamIndicators <= 4) {
      summary = `Official business number found (${business}), but ${storedScamIndicators} stored report(s) and ${webScamIndicators} web finding(s) exist for this exact number — it may be impersonated or spoofed. Verify the caller independently.`;
    } else {
      summary = `Official business number found (${business}), but multiple reports and web findings suggest this number is actively being spoofed. Do not trust the caller based on caller ID alone.`;
    }
  } else {
    if (totalScamIndicators === 0) {
      summary = communitySafe > 0
        ? `No scam reports found for this exact number. ${communitySafe} community report(s) mark it as safe.`
        : `No verified community, indexed, or web reports found for this number. There is insufficient evidence to classify it.`;
    } else if (storedScamIndicators === 0 && webScamIndicators === 1) {
      summary = `One web page mentions this exact number in a scam context. There is insufficient stored evidence to confirm a scam.`;
    } else if (storedScamIndicators === 0 && webScamIndicators >= 2) {
      summary = `${webScamIndicators} web pages mention this exact number in a scam context, but no stored community reports exist yet. This number is suspicious but not yet confirmed.`;
    } else if (storedScamIndicators >= 1 && webScamIndicators >= 1) {
      summary = `${storedScamIndicators} stored report(s) and ${webScamIndicators} web finding(s) corroborate scam activity for this exact number.`;
    } else if (storedScamIndicators >= 3) {
      summary = `${storedScamIndicators} scam reports across community and indexed sources indicate this number is likely associated with scams.`;
    } else {
      summary = `${totalScamIndicators} report(s) exist for this exact number. This number is suspicious but not yet confirmed.`;
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
      stored_scam_indicators: storedScamIndicators,
      web_scam_indicators: webScamIndicators,
      independent_sources: independentSources,
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
      web: {
        matched: webCount > 0,
        report_count: webCount,
        sources: webFindings.map((r) => r.url).filter(Boolean),
        reports: webFindings.map((r) => ({
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          category: r.category,
        })),
      },
      assessment_basis: "stored community reports + indexed public reports + live web findings + official registry (exact number match only)",
    },
  };
}