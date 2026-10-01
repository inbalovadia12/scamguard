import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

type AnyRecord = Record<string, any>;
const NEGATIVE = /scam|fraud|fraudulent|spam|robocall|robo[- ]?call|phishing|spoof|telemarketer|telemarketing|harass|threat|extortion|impersonat|fake|loan scam|refund scam|tech support|gift card|crypto scam|investment scam|payment scam/i;
const POSITIVE = /legitimate|verified business|official|customer service|support line|government|bank|hospital|university|school|delivery|courier|utility|emergency|insurance/i;

function clamp(n: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(n))); }
function num(v: any): number | null { const n = Number(v); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n; }
function uniqueStrings(values: any[]) { return Array.from(new Set(values.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()))); }

function scorePhone(evidence: AnyRecord) {
  const identity = evidence?.identity_facts || {};
  const signals = evidence?.reputation_signals || {};
  const counts = evidence?.counts || {};
  const reports = Array.isArray(evidence?.reports) ? evidence.reports : [];

  const classified = reports.map((r: AnyRecord) => {
    const text = [r.category, r.text, r.raw?.reason, r.raw?.type, r.raw?.subject].filter(Boolean).join(" ");
    return { report: r, negative: NEGATIVE.test(text), positive: POSITIVE.test(text), text };
  });
  const negativeReports = classified.filter((x) => x.negative && x.report.source !== "web_search").length;
  const positiveReports = classified.filter((x) => x.positive).length;
  const verifiedWeb = reports.filter((r: AnyRecord) => r.source === "web_search" && r.verified_exact_number === true);
  const webNegative = verifiedWeb.filter((r: AnyRecord) => NEGATIVE.test([r.text, r.url].filter(Boolean).join(" "))).length;
  const redditVerified = verifiedWeb.filter((r: AnyRecord) => /reddit\.com/i.test(String(r.url || ""))).length;

  let score = 50;
  const reasons: string[] = [];
  const legitimacy: string[] = [];

  if (negativeReports > 0) {
    score += Math.min(32, negativeReports * 9);
    reasons.push(negativeReports + " exact-number report" + (negativeReports === 1 ? "" : "s") + " contain scam/spam/fraud indicators.");
  }
  if (webNegative > 0) {
    score += Math.min(24, webNegative * 8);
    reasons.push(webNegative + " verified public web result" + (webNegative === 1 ? "" : "s") + " mention the exact number in a scam/spam/fraud context.");
  }
  if (redditVerified > 0) {
    score += Math.min(12, redditVerified * 6);
    reasons.push(redditVerified + " verified Reddit result" + (redditVerified === 1 ? "" : "s") + " contain the exact number.");
  }

  const complaintCount = num(counts.complaint_count) ?? 0;
  const communityCount = num(counts.community_report_count) ?? 0;
  if (complaintCount > 0) {
    score += Math.min(20, 5 + Math.log10(complaintCount + 1) * 7);
    reasons.push(String(complaintCount) + " complaint" + (complaintCount === 1 ? "" : "s") + " returned by an available complaint source.");
  }
  if (communityCount > 0) {
    score += Math.min(18, communityCount * 4);
    reasons.push(String(communityCount) + " community report" + (communityCount === 1 ? "" : "s") + " returned.");
  }

  const providerRisk = num(signals.scamcallcheck_risk_score);
  if (providerRisk !== null) {
    score += (providerRisk - 50) * 0.22;
    if (providerRisk >= 70) reasons.push("ScamCallCheck reports a high risk signal (" + clamp(providerRisk) + "/100).");
  }

  const numbersSpam = num(signals.numbers_online_spam_signal);
  if (numbersSpam !== null) {
    const normalizedSpam = numbersSpam > 1 ? numbersSpam : numbersSpam * 100;
    score += (normalizedSpam - 50) * 0.12;
    if (normalizedSpam >= 70) reasons.push("Numbers Online reports a high spam signal (" + clamp(normalizedSpam) + "/100).");
  }

  const robocall = String(signals.us_robocall_flag ?? "").toLowerCase();
  if (robocall === "true" || robocall === "yes" || robocall === "1") {
    score += 8;
    reasons.push("The available US complaint source flags the number for robocall complaints.");
  }

  if (identity.caller_name) {
    score -= 10;
    legitimacy.push("Business/caller identity returned: " + identity.caller_name + ".");
  }
  if (positiveReports > 0) {
    score -= Math.min(12, positiveReports * 4);
    legitimacy.push(String(positiveReports) + " report" + (positiveReports === 1 ? "" : "s") + " contain legitimate/official context.");
  }

  const hasNegativeEvidence =
    negativeReports > 0 || webNegative > 0 || complaintCount > 0 || communityCount > 0 ||
    (providerRisk !== null && providerRisk >= 70) ||
    (numbersSpam !== null && (numbersSpam > 1 ? numbersSpam >= 70 : numbersSpam >= 0.7));

  const hasLegitimateEvidence = Boolean(identity.caller_name) || positiveReports > 0 ||
    Boolean(signals.scamcallcheck_risk_level && /safe|legitimate|verified/i.test(String(signals.scamcallcheck_risk_level)));

  if (!hasNegativeEvidence && !hasLegitimateEvidence) score = 50;

  let status: "SCAM" | "SUSPICIOUS" | "SAFE" | "UNKNOWN";
  if (!hasNegativeEvidence && !hasLegitimateEvidence) status = "UNKNOWN";
  else if (score >= 71) status = "SCAM";
  else if (score >= 31) status = "SUSPICIOUS";
  else status = "SAFE";

  const riskLevel = score >= 71 ? "high" : score >= 31 ? "medium" : "low";
  const evidenceCount = Number(counts.exact_evidence_count || 0);
  const providerSuccesses = Object.values(evidence?.source_status || {}).filter((v) => v === "ok").length;
  const providerErrors = Array.isArray(evidence?.provider_errors) ? evidence.provider_errors.length : 0;
  const confidence = clamp(35 + Math.min(35, evidenceCount * 7) + Math.min(20, providerSuccesses * 7) - Math.min(20, providerErrors * 5) + (verifiedWeb.length > 0 ? 8 : 0));

  const categories = uniqueStrings(
    reports.map((r: AnyRecord) => [r.category, r.raw?.category, r.raw?.scam_type, r.raw?.type]).flat()
  ).filter((v) => v.length < 80).slice(0, 8);

  return {
    reputation_score: clamp(score),
    risk_score: clamp(score),
    risk_level: riskLevel,
    caller_id_status: status,
    confidence_score: confidence,
    verified_business: Boolean(identity.caller_name),
    business_name: identity.caller_name || null,
    business_name_source: identity.caller_name_source || null,
    country: identity.country || null,
    carrier: identity.carrier || null,
    line_type: identity.line_type || null,
    report_count: evidenceCount,
    scam_report_count: negativeReports,
    spam_report_count: reports.filter((r: AnyRecord) => /spam|robocall/i.test([r.category, r.text].filter(Boolean).join(" "))).length,
    suspicious_report_count: Math.max(0, negativeReports - reports.filter((r: AnyRecord) => /scam|fraud|phishing|impersonat/i.test([r.category, r.text].filter(Boolean).join(" "))).length),
    safe_report_count: positiveReports,
    scam_categories: categories,
    evidence_reasons: reasons,
    legitimacy_reasons: legitimacy,
    evidence_state: evidence?.evidence_state || "insufficient_evidence",
    web_evidence_state: evidence?.web_evidence_state || "no_web_results",
    provider_errors: evidence?.provider_errors || [],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const evidence = body?.phone_evidence;
    if (!evidence || typeof evidence !== "object") return Response.json({ error: "phone_evidence is required" }, { status: 400 });
    return Response.json({ engine: "vardin_phone_risk_v1", normalized_number: evidence.normalized_number || body?.phone || null, result: scorePhone(evidence) });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Phone risk engine failed" }, { status: 500 });
  }
});