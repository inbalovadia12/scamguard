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
  const riskLabel = (analysis.risk_level || "unknown").toUpperCase();
  await base44.integrations.Core.SendEmail({
    to: link.guardian_email,
    subject: `Vardin Alert: ${link.name} checked a ${riskLabel} risk message`,
    body: `Hi ${link.guardian_name || "there"},\n\n${link.name} just checked a suspicious message on Vardin.\n\nRisk level: ${riskLabel} (${analysis.risk_score}/100)\nType: ${analysis.message_type || "other"}\n\nSummary: ${analysis.explanation || ""}\n\nView full details in your Guardian Alerts: ${window.location.origin}/alerts\n\nStay safe,\nThe Vardin Team`,
  });
}