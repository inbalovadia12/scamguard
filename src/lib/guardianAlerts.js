import { base44 } from "@/api/base44Client";

const FINANCIAL_TYPES = ["bank_government", "marketplace", "crypto_investment", "lottery_prize", "job_offer"];

// Returns the consented ProtectedSenior record linking this user to a guardian, if any
export async function getSeniorLink(userId) {
  const links = await base44.entities.ProtectedSenior.filter({ senior_user_id: userId, consent_given: true });
  return links[0] || null;
}

export function shouldNotifyGuardian(link, analysis) {
  if (!link?.guardian_email) return false;
  const pref = link.alert_preference || "all";
  if (pref === "high_risk_only") return analysis.risk_level === "high";
  if (pref === "financial_only") return FINANCIAL_TYPES.includes(analysis.message_type) || analysis.risk_level === "high";
  return true;
}

export async function notifyGuardian(link, analysis) {
  // Delegate to the backend function, which re-derives the recipient from the
  // verified family relationship and builds the body from server-verified
  // analysis data — never from client-supplied entity fields.
  await base44.functions.invoke("sendGuardianScanAlert", { analysis_id: analysis.id });
}