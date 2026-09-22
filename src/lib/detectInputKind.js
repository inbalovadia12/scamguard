// Detect whether a free-text input is a URL or a phone number.
// Used by the URL/phone scanner inputs in Message Check and Universal Scanner.
export function detectInputKind(value) {
  const v = (value || "").trim();
  if (!v) return "unknown";
  if (/^https?:\/\//i.test(v)) return "url";
  const digits = v.replace(/[^\d]/g, "");
  const letters = (v.match(/[a-zA-Z]/g) || []).length;
  // Pure phone-style string: digits and separators only, 7+ digits, no letters.
  if (/^[+]?[\d\s\-().]+$/.test(v) && digits.length >= 7 && letters === 0) return "phone";
  // Domain-like: contains a dot, no spaces.
  if (v.includes(".") && !v.includes(" ")) return "url";
  // 7+ digits, no letters => phone.
  if (digits.length >= 7 && letters === 0) return "phone";
  // Otherwise treat as URL (scanUrl will validate).
  return "url";
}