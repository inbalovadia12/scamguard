// Shared risk + severity styling for the Fine Print Scanner.
// Class names are written out in full so Tailwind keeps them in the build.

export const RISK_LEVELS = {
  low: {
    key: "low",
    label: "Low risk",
    tag: "Nothing unusual stands out",
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    stroke: "text-success",
  },
  medium: {
    key: "medium",
    label: "Medium risk",
    tag: "Read a few clauses carefully",
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    stroke: "text-warning",
  },
  high: {
    key: "high",
    label: "High risk",
    tag: "Several terms work against you",
    text: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    stroke: "text-orange-500",
  },
  very_high: {
    key: "very_high",
    label: "Very high risk",
    tag: "Serious concerns found",
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    stroke: "text-destructive",
  },
};

export const SEVERITIES = {
  high: {
    key: "high",
    label: "High",
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
  },
  medium: {
    key: "medium",
    label: "Medium",
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  low: {
    key: "low",
    label: "Low",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function normalizeLevel(level, score) {
  const raw = String(level || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (RISK_LEVELS[raw]) return RISK_LEVELS[raw];
  const value = Number(score) || 0;
  if (value >= 81) return RISK_LEVELS.very_high;
  if (value >= 61) return RISK_LEVELS.high;
  if (value >= 36) return RISK_LEVELS.medium;
  return RISK_LEVELS.low;
}

export function normalizeSeverity(severity) {
  const raw = String(severity || "").toLowerCase().trim();
  return SEVERITIES[raw] ? raw : "medium";
}

export function sortRedFlags(flags) {
  return [...(Array.isArray(flags) ? flags : [])].sort(
    (a, b) => (SEVERITY_ORDER[normalizeSeverity(a?.severity)] ?? 1) - (SEVERITY_ORDER[normalizeSeverity(b?.severity)] ?? 1)
  );
}

export const DOCUMENT_TYPES = [
  { value: "auto", label: "Auto-detect" },
  { value: "lease", label: "Lease" },
  { value: "subscription", label: "Subscription" },
  { value: "gym_service", label: "Gym or Service Contract" },
  { value: "loan_credit", label: "Loan or Credit" },
  { value: "medical_bill", label: "Medical Bill" },
  { value: "terms_of_service", label: "Terms of Service" },
  { value: "other", label: "Other" },
];

export function documentTypeLabel(value) {
  const found = DOCUMENT_TYPES.find((type) => type.value === value);
  return found ? found.label : "Document";
}