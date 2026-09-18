import { sendGmail, getGmailSenderEmail, encodeSubject } from "./gmailMime.ts";

// Shared helpers for Gmail-based scam-alert emails (guardian alerts and the
// user's own high-risk alert). Keeps the email-body formatting in one place.

export function formatRiskLabel(analysis: any): string {
  return (analysis.risk_level || "unknown").toUpperCase();
}

export function formatSteps(analysis: any): string {
  return (analysis.next_steps || []).map((s: string) => "  • " + s).join("\n");
}

export function formatTactics(analysis: any): string {
  return (analysis.tactics_detected || []).join(", ") || "None detected";
}

export interface AlertEmailInput {
  accessToken: string;
  recipientName: string;
  recipientEmail: string;
  analysis: any;
  subject: string;
  introLine: string;
  reviewLink: string;
}

/**
 * Builds and sends a scam-alert email through the shared Gmail connection.
 * Returns true on success. The caller is responsible for any de-duplication
 * / status bookkeeping after a successful send.
 */
export async function sendAnalysisAlertEmail(input: AlertEmailInput): Promise<boolean> {
  const senderEmail = await getGmailSenderEmail(input.accessToken);
  const analysis = input.analysis || {};
  const typeLabel = (analysis.message_type || "message").replace(/_/g, " ");
  const steps = formatSteps(analysis) || "  No specific steps available.";

  const bodyText = [
    `Hi ${input.recipientName || "there"},`,
    ``,
    input.introLine,
    ``,
    `Risk Score: ${analysis.risk_score ?? "?"}/100`,
    `Message Type: ${typeLabel}`,
    ``,
    `Summary:`,
    `${analysis.explanation || "No summary available."}`,
    ``,
    `Tactics Detected: ${formatTactics(analysis)}`,
    ``,
    `Recommended Next Steps:`,
    `${steps}`,
    ``,
    `Review it here:`,
    input.reviewLink,
    ``,
    `Stay safe,`,
    `The Vardin Team`,
  ].join("\n");

  const mimeMessage = [
    `From: Vardin Alerts <${senderEmail}>`,
    `To: ${input.recipientName || ""} <${input.recipientEmail}>`,
    `Subject: ${encodeSubject(input.subject)}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
    ``,
    bodyText,
  ].join("\r\n");

  return sendGmail(input.accessToken, mimeMessage);
}