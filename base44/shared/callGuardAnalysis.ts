// === Call Guard contextual scam analysis ===
// Replaces keyword-based detection with a contextual LLM analysis that
// considers the full conversation, uses a progressive risk model, and
// distinguishes indicators from confirmed scams.
//
// Used by: analyzeCallChunk backend function.

export interface ConversationTurn {
  speaker: "caller" | "you" | "unknown";
  text: string;
}

export interface ScamIndicator {
  type: string;
  description: string;
  confidence: number; // 0-1
}

export interface ScamWarning {
  title: string;
  explanation: string;
  action: string;
  severity: "caution" | "suspicious" | "high";
}

export interface ScamAnalysisResult {
  risk_level: "low" | "medium" | "high";
  new_indicators: ScamIndicator[];
  warnings: ScamWarning[];
  feedback: string;
  summary: string;
}

// Build the LLM prompt for contextual scam analysis.
// The LLM receives the full conversation and the list of already-reported
// indicators so it can avoid duplicating warnings.
export function buildAnalysisPrompt(
  conversation: ConversationTurn[],
  reportedIndicators: string[],
  language: string
): string {
  const languageNames: Record<string, string> = {
    en: "English",
    he: "Hebrew",
    es: "Spanish",
  };
  const languageName = languageNames[language] || "English";

  const transcript = conversation
    .map((t) => `[${t.speaker}]: ${t.text}`)
    .join("\n");

  const reported =
    reportedIndicators.length > 0
      ? reportedIndicators.join(", ")
      : "none";

  return `You are a scam detection analyst monitoring a phone call in real time. Analyze the conversation and assess scam risk. Respond in ${languageName}.

CONVERSATION SO FAR:
${transcript || "(just starting)"}

INDICATORS ALREADY REPORTED (do not report these again):
${reported}

ANALYSIS RULES:
1. An authority claim alone — someone identifying themselves as a hospital, bank, police, delivery company, school, etc. — is NOT a scam indicator. Legitimate organizations introduce themselves at the start of calls. Only flag authority when combined with urgency, payment requests, credential requests, threats, or pressure to bypass verification.
2. KEYWORD-BASED FLAGS ARE FORBIDDEN. Words like "crypto", "reward", "invite", "verification", "promotion", "bonus", "gift", "prize", "investment", "account", "security", "verify", "confirm" are NOT scam indicators on their own. Legitimate businesses use these words constantly in normal communications. Only flag the underlying BEHAVIOR — an actual request for money, passwords, recovery phrases, remote access, or a demand to act secretly/urgently — not the vocabulary.
3. LEGITIMATE BUSINESS CONTEXT IS NOT A SCAM. Financial promotions, investment-platform invitations, account-security notifications, promotional credit offers, and normal verification links (e.g., a bank sending a verification code to confirm your own login) are NOT scams. If a message/call has normal business context and does NOT request money, passwords, recovery phrases, remote access, or unusual secrecy, the risk is "low" and confidence must be reduced.
4. Require MULTIPLE MEANINGFUL indicators or clear evidence of fraud before assigning a scam verdict. A single ambiguous signal is NOT enough. Look for combinations: urgency + payment demand, authority + threat + credential request, secrecy + remote access request, etc. The more indicators that co-occur, the higher the confidence.
5. Distinguish INDICATORS (possible scam signals) from confirmed scams. Never say "scam detected" or "scam confirmed" unless there are multiple strong indicators. Use cautious language: "potential", "may indicate", "consider verifying".
6. Progressive risk model:
   - "low": no meaningful indicators, OR a single weak ambiguous signal with normal business context (e.g., a bank calling about a transaction and offering to verify via official channels, a company inviting you to an investment platform with no request for money/credentials)
   - "medium": one moderate indicator or two weak ones (e.g., authority claim + urgency, but no payment request yet) — but NOT if the only "indicator" is a keyword with no request for action
   - "high": multiple strong indicators or a clear scam pattern (e.g., authority + emergency + payment demand + credential request, or a demand for gift cards / crypto / remote access)
7. Only report NEW indicators not in the already-reported list. If the conversation hasn't changed in a way that introduces new indicators, return empty new_indicators and keep the risk level steady.
8. Each warning must have: a title (what was detected), an explanation (why it matters in context), and an action (what the user should do). Warnings should be informative, not alarmist. Severity "caution" for weak signals, "suspicious" for moderate, "high" for strong.
9. If the conversation is normal (e.g., a hospital calling about an appointment, a bank confirming a transaction, a company promoting a legitimate investment product, a service sending a verification code for your own login), return risk_level "low", empty indicators, empty warnings.

Return ONLY a JSON object:
{
  "risk_level": "low" | "medium" | "high",
  "new_indicators": [{"type": "string", "description": "string", "confidence": 0.0-1.0}],
  "warnings": [{"title": "string", "explanation": "string", "action": "string", "severity": "caution"|"suspicious"|"high"}],
  "feedback": "one sentence of coaching advice, or empty if nothing notable",
  "summary": "one sentence assessment"
}`;
}

// Indicator types and their weights for the progressive risk model.
// Weight = how strongly this indicator contributes to scam risk.
// Authority claim is intentionally low — it's common in legitimate calls.
export const INDICATOR_WEIGHTS: Record<string, number> = {
  authority_claim: 0.10,
  urgency: 0.20,
  threat: 0.25,
  emotional_manipulation: 0.20,
  payment_request: 0.30,
  credential_request: 0.40,
  otp_request: 0.50,
  personal_info_request: 0.30,
  software_install_request: 0.40,
  gift_card_request: 0.50,
  crypto_request: 0.40,
  secrecy_request: 0.25,
  verify_bypass: 0.30,
  platform_switch: 0.20,
  callback_instruction: 0.15,
  impersonation: 0.20,
};

// Compute a weighted risk level from indicators.
// This supplements the LLM's judgment with a consistent scoring floor.
export function computeWeightedRisk(
  indicators: ScamIndicator[],
  previouslySeen: string[]
): "low" | "medium" | "high" {
  const newOnes = indicators.filter((i) => !previouslySeen.includes(i.type));
  if (newOnes.length === 0) return "low";

  const totalWeight = newOnes.reduce(
    (sum, i) => sum + (INDICATOR_WEIGHTS[i.type] ?? 0.15) * (i.confidence ?? 0.5),
    0
  );

  // Progressive thresholds:
  // - One weak indicator (weight ~0.10) → total ~0.10 → low (no warning)
  // - One moderate (weight ~0.20-0.25) → total ~0.20-0.25 → medium
  // - Multiple strong (weight ~0.30+) → total > 0.50 → high
  if (totalWeight >= 0.40) return "high";
  if (totalWeight >= 0.20) return "medium";
  return "low";
}

// Merge the LLM risk level with the weighted risk level, taking the higher
// of the two so the LLM can escalate but the floor prevents single-keyword
// false positives from jumping straight to "high".
export function mergeRiskLevels(
  llmLevel: string,
  weightedLevel: string
): "low" | "medium" | "high" {
  const order = { low: 0, medium: 1, high: 2 };
  const a = order[llmLevel as keyof typeof order] ?? 0;
  const b = order[weightedLevel as keyof typeof order] ?? 0;
  const max = Math.max(a, b);
  return max === 2 ? "high" : max === 1 ? "medium" : "low";
}

// Run the contextual LLM scam analysis on a conversation. Shared by
// analyzeCallChunk (uploaded recordings) and analyzeCallSegment (live
// streaming), so the analysis logic is never copied between functions.
export async function analyzeScamContext(
  base44: any,
  conversation: ConversationTurn[],
  reportedIndicators: string[],
  language: string
): Promise<ScamAnalysisResult> {
  const prompt = buildAnalysisPrompt(conversation, reportedIndicators, language);
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          risk_level: { type: "string", enum: ["low", "medium", "high"] },
          new_indicators: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                description: { type: "string" },
                confidence: { type: "number" },
              },
            },
          },
          warnings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                explanation: { type: "string" },
                action: { type: "string" },
                severity: { type: "string", enum: ["caution", "suspicious", "high"] },
              },
            },
          },
          feedback: { type: "string" },
          summary: { type: "string" },
        },
        required: ["risk_level"],
      },
    });

    const data = typeof result === "string" ? JSON.parse(result) : result;
    const indicators = Array.isArray(data.new_indicators) ? data.new_indicators : [];
    const weighted = computeWeightedRisk(indicators, reportedIndicators);
    const merged = mergeRiskLevels(data.risk_level || "low", weighted);

    return {
      risk_level: merged as "low" | "medium" | "high",
      new_indicators: indicators,
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      feedback: data.feedback || "",
      summary: data.summary || "",
    };
  } catch (e) {
    console.error("Scam analysis LLM error:", e?.message);
    return {
      risk_level: "low",
      new_indicators: [],
      warnings: [],
      feedback: "",
      summary: "Analysis temporarily unavailable.",
    };
  }
}