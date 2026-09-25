// Canonical phone-number reputation helpers shared across Vardin backend functions.
//
// PhoneReputation is the global, deduped reputation index (one row per normalized
// number). It is FED BY Vardin's existing lookupPhoneNumber engine + PhoneLookup
// history — it is NOT a second, independent scam-detection engine.

export const DEFAULT_CONFIG = {
  scam_label: "Vardin: Scam Likely",
  spam_label: "Vardin: Spam",
  suspicious_label: "Vardin: Suspicious",
  safe_label: "Vardin: Safe",
  unknown_label: "", // UNKNOWN numbers get no Call Directory entry by default
  min_confidence: 60, // 0-100 confidence required to publish a caller-ID entry
  include_safe: false, // whether to publish SAFE (non-verified) numbers
  include_verified_businesses: true,
  entitled_plans: ["plus", "premium"],
};

export type CallerIdStatus = "SCAM" | "SPAM" | "SUSPICIOUS" | "SAFE" | "UNKNOWN";

// Normalize any phone input to a canonical E.164-ish key: "+" + digits.
// Returns null when input is not a plausible phone number (validates all input).
export function normalizePhoneNumber(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim();
  if (!cleaned) return null;
  const digits = cleaned.replace(/[^\d]/g, "");
  if (!digits) return null;
  // national numbers are at least 7 digits; reject absurdly short/long inputs
  if (digits.length < 7 || digits.length > 15) return null;
  return "+" + digits;
}

// Derive caller-id status from a reputation record / lookup result.
// Community reports take priority over the LLM risk score; UNKNOWN is never
// auto-classified as a scam.
export function statusFromReputation(input: any): CallerIdStatus {
  const scam = input.scam_report_count || 0;
  const spam = input.spam_report_count || 0;
  const susp = input.suspicious_report_count || 0;
  const safe = input.safe_report_count || 0;
  const score = input.reputation_score ?? 0;

  // A verified official business identity is strong positive identity evidence,
  // but it is not proof that every call displaying that number is legitimate:
  // caller-ID spoofing can make a scammer appear as a real business.
  // Evaluate exact-number negative evidence first; the UI can still show the
  // verified business badge separately.

  // Negative categories are intentionally ordered by severity, not by count.
  // One exact scam report must never be downgraded to SPAM merely because there
  // are more nuisance/telemarketing reports.
  if (scam > 0) return "SCAM";
  if (spam > 0) return "SPAM";
  if (susp > 0) return "SUSPICIOUS";
  if (safe > 0) return "SAFE";
  if (input.verified_business) return "SAFE";

  // The LLM score/risk level is provisional and must never create a caller-ID
  // classification by itself. Without exact-number evidence, the correct state
  // is UNKNOWN even when the research model produced a non-zero score.
  return "UNKNOWN";
}

// Map status -> caller-id display label using config (never throws).
export function computeLabel(status: CallerIdStatus, config: any): string {
  const cfg = config || DEFAULT_CONFIG;
  switch (status) {
    case "SCAM": return cfg.scam_label || DEFAULT_CONFIG.scam_label;
    case "SPAM": return cfg.spam_label || DEFAULT_CONFIG.spam_label;
    case "SUSPICIOUS": return cfg.suspicious_label || DEFAULT_CONFIG.suspicious_label;
    case "SAFE": return cfg.safe_label || DEFAULT_CONFIG.safe_label;
    default: return cfg.unknown_label ?? "";
  }
}

// Confidence in the classification: how much evidence backs the status.
export function computeConfidence(input: any): number {
  const total =
    (input.scam_report_count || 0) +
    (input.spam_report_count || 0) +
    (input.suspicious_report_count || 0) +
    (input.safe_report_count || 0);
  // Negative exact-number evidence must never receive 100% confidence merely
  // because the displayed number is also a verified business. Spoofing and
  // impersonation are possible, so the threat classification needs to remain
  // visible alongside the identity match.
  if (input.scam_report_count > 0) {
    if (total >= 10) return 95;
    if (total >= 5) return 90;
    if (total >= 3) return 85;
    return 75;
  }
  if (input.suspicious_report_count > 0) {
    if (total >= 5) return 85;
    if (total >= 3) return 75;
    return 65;
  }
  if (input.spam_report_count > 0) {
    if (total >= 5) return 80;
    if (total >= 3) return 70;
    return 65;
  }
  if (input.safe_report_count > 0 || input.verified_business) return 100;
  return 0;
}

// Whether a reputation record should appear in the published Call Directory dataset.
export function qualifiesForDataset(rep: any, config: any): boolean {
  const cfg = config || DEFAULT_CONFIG;
  const status: CallerIdStatus = rep.caller_id_status || rep.status || "UNKNOWN";
  const confidence = rep.confidence_score ?? 0;
  const minConf = cfg.min_confidence ?? DEFAULT_CONFIG.min_confidence;
  if (confidence < minConf) return false;
  if (status === "UNKNOWN") return false;
  if (status === "SAFE") {
    if (cfg.include_safe) return true;
    if (cfg.include_verified_businesses && rep.verified_business) return true;
    return false;
  }
  return true; // SCAM / SPAM / SUSPICIOUS
}

// Reuse Vardin's existing subscription/plan hierarchy for caller-ID entitlement.
export function isCallerIdEntitled(user: any, config?: any): boolean {
  const plan = String(user?.subscription_plan || "starter").toLowerCase();
  const plans = (config?.entitled_plans || DEFAULT_CONFIG.entitled_plans).map((p: string) => String(p).toLowerCase());
  return plans.includes(plan);
}

// Load the active CallerIdConfig record (most recent), or fall back to defaults.
export async function getConfig(base44: any): Promise<any> {
  try {
    const rows = await base44.asServiceRole.entities.CallerIdConfig.list("-updated_at", 1);
    if (rows && rows.length > 0) return { ...DEFAULT_CONFIG, ...rows[0] };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

// Upsert the canonical reputation record for a number. Dedupes by normalized_number,
// merges report counts, and recomputes status / label / confidence. Does NOT touch
// the Call Directory dataset tables (those are updated by regenerateDataset).
export async function upsertPhoneReputation(base44: any, data: any): Promise<any> {
  const nn = normalizePhoneNumber(data?.normalized_number);
  if (!nn) return null;
  const config = await getConfig(base44);
  const now = new Date().toISOString();

  const existing = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: nn });

  if (existing.length > 0) {
    const rep = existing[0];
    const patch: any = {
      last_checked_at: now,
      last_updated_at: now,
      last_external_check_at: data.last_external_check_at || now,
    };
    if (data.phone_number) patch.phone_number = data.phone_number;
    if (data.country) patch.country = data.country;
    if (data.country_code) patch.country_code = data.country_code;
    if (data.carrier) patch.carrier = data.carrier;
    if (data.reputation_score != null) patch.reputation_score = data.reputation_score;
    if (data.risk_level) patch.risk_level = data.risk_level;
    if (data.scam_categories) patch.scam_categories = data.scam_categories;
    if (data.summary) patch.summary = data.summary;
    if (data.sources) {
      const incomingSources = Array.isArray(data.sources) ? data.sources : [];
      const existingSources = Array.isArray(rep.sources) ? rep.sources : [];
      patch.sources = Array.from(new Set([...existingSources, ...incomingSources])).filter(Boolean);
    }
    // Identity evidence is also monotonic: a fresh LLM pass that fails to
    // rediscover an official page must not erase a previously verified business.
    if (data.verified_business === true) patch.verified_business = true;
    if (data.business_name) patch.business_name = data.business_name;
    if (data.lookup_country != null) patch.lookup_country = data.lookup_country;

    if (data.report) {
      const inc = data.report.count ?? 1;
      patch.report_count = (rep.report_count || 0) + inc;
      if (data.report.type === "scam") patch.scam_report_count = (rep.scam_report_count || 0) + inc;
      else if (data.report.type === "spam") patch.spam_report_count = (rep.spam_report_count || 0) + inc;
      else if (data.report.type === "suspicious") patch.suspicious_report_count = (rep.suspicious_report_count || 0) + inc;
      else if (data.report.type === "safe") patch.safe_report_count = (rep.safe_report_count || 0) + inc;
    }

    // Deep research can rediscover only a subset of previously known reports.
    // Never let a later search erase stronger historical evidence. Counts therefore
    // move monotonically upward; a future verified source can add evidence but
    // cannot make an existing scam/spam/suspicious report disappear.
    if (data.report_counts) {
      const rc = data.report_counts;
      patch.scam_report_count = Math.max(rep.scam_report_count || 0, Number(rc.scam) || 0);
      patch.spam_report_count = Math.max(rep.spam_report_count || 0, Number(rc.spam) || 0);
      patch.suspicious_report_count = Math.max(rep.suspicious_report_count || 0, Number(rc.suspicious) || 0);
      patch.safe_report_count = Math.max(rep.safe_report_count || 0, Number(rc.safe) || 0);
      patch.report_count = patch.scam_report_count + patch.spam_report_count + patch.suspicious_report_count + patch.safe_report_count;
    }

    const next: any = {
      reputation_score: patch.reputation_score ?? rep.reputation_score,
      risk_level: patch.risk_level ?? rep.risk_level,
      scam_report_count: patch.scam_report_count ?? rep.scam_report_count,
      spam_report_count: patch.spam_report_count ?? rep.spam_report_count,
      suspicious_report_count: patch.suspicious_report_count ?? rep.suspicious_report_count,
      safe_report_count: patch.safe_report_count ?? rep.safe_report_count,
      verified_business: patch.verified_business ?? rep.verified_business,
    };

    // The canonical reputation record must not preserve a stale numeric score
    // that contradicts the evidence/status. Re-derive the score from the final
    // merged evidence every time an existing record is updated. Negative exact
    // evidence remains authoritative; verified businesses without negative
    // evidence are capped at low risk.
    const scam = Number(next.scam_report_count) || 0;
    const spam = Number(next.spam_report_count) || 0;
    const suspicious = Number(next.suspicious_report_count) || 0;
    const safe = Number(next.safe_report_count) || 0;
    let canonicalScore = Number(next.reputation_score);
    if (!Number.isFinite(canonicalScore)) canonicalScore = 0;
    canonicalScore = Math.max(0, Math.min(100, canonicalScore));
    if (scam > 0) canonicalScore = Math.max(75, canonicalScore);
    else if (verifiedOrSafe(next)) canonicalScore = Math.min(canonicalScore || 10, 30);
    else if (spam > 0 && suspicious === 0) canonicalScore = Math.max(50, Math.min(canonicalScore, 60));
    else if (suspicious > 0) canonicalScore = Math.max(41, Math.min(canonicalScore, 70));
    next.reputation_score = canonicalScore;
    next.risk_level = canonicalScore >= 71 || scam > 0 ? 'high' : canonicalScore >= 41 || spam > 0 || suspicious > 0 ? 'medium' : 'low';
    patch.reputation_score = canonicalScore;
    patch.risk_level = next.risk_level;
    patch.caller_id_status = statusFromReputation(next);
    patch.caller_id_label = computeLabel(patch.caller_id_status, config);
    patch.confidence_score = computeConfidence(next);

    await base44.asServiceRole.entities.PhoneReputation.update(rep.id, patch);
    return { ...rep, ...patch };
  }

  // create new canonical record
  const rc = data.report_counts;
  const scam = rc ? (rc.scam || 0) : (data.report?.type === "scam" ? (data.report.count ?? 1) : 0);
  const spam = rc ? (rc.spam || 0) : (data.report?.type === "spam" ? (data.report.count ?? 1) : 0);
  const susp = rc ? (rc.suspicious || 0) : (data.report?.type === "suspicious" ? (data.report.count ?? 1) : 0);
  const safe = rc ? (rc.safe || 0) : (data.report?.type === "safe" ? (data.report.count ?? 1) : 0);
  const status = statusFromReputation({
    reputation_score: data.reputation_score,
    risk_level: data.risk_level,
    scam_report_count: scam,
    spam_report_count: spam,
    suspicious_report_count: susp,
    safe_report_count: safe,
    verified_business: data.verified_business,
  });

  return await base44.asServiceRole.entities.PhoneReputation.create({
    normalized_number: nn,
    phone_number: data.phone_number || nn,
    country: data.country || "",
    country_code: data.country_code || "",
    carrier: data.carrier || "",
    reputation_score: data.reputation_score || 0,
    risk_level: data.risk_level || "low",
    caller_id_status: status,
    confidence_score: computeConfidence({
      scam_report_count: scam, spam_report_count: spam, suspicious_report_count: susp,
      safe_report_count: safe, verified_business: data.verified_business, reputation_score: data.reputation_score,
    }),
    report_count: scam + spam + susp + safe,
    scam_report_count: scam,
    spam_report_count: spam,
    suspicious_report_count: susp,
    safe_report_count: safe,
    verified_business: !!data.verified_business,
    business_name: data.business_name || "",
    lookup_country: data.lookup_country || "",
    scam_categories: data.scam_categories || [],
    last_checked_at: now,
    last_updated_at: now,
    last_external_check_at: data.last_external_check_at || now,
    caller_id_label: computeLabel(status, config),
    in_call_directory: false,
    dataset_version: 0,
    summary: data.summary || "",
    sources: data.sources || [],
  });
}