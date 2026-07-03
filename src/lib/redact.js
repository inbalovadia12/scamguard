// Auto-redacts sensitive data from messages before storage
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const BTC_RE = /\b(bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,62}\b/g;
const ETH_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const CARD_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

export function redactMessage(text) {
  if (!text) return text;
  let redacted = text;
  redacted = redacted.replace(PHONE_RE, "[PHONE REDACTED]");
  redacted = redacted.replace(EMAIL_RE, "[EMAIL REDACTED]");
  redacted = redacted.replace(SSN_RE, "[SSN REDACTED]");
  redacted = redacted.replace(CARD_RE, "[CARD REDACTED]");
  redacted = redacted.replace(ETH_RE, "[WALLET REDACTED]");
  redacted = redacted.replace(BTC_RE, "[WALLET REDACTED]");
  return redacted;
}