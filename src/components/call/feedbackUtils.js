export function getFeedbackSentiment(text) {
  const lower = (text || "").toLowerCase();
  const positive = [
    "great job", "good job", "well done", "perfect", "smart", "excellent",
    "keep it up", "nice work", "right call", "good thinking", "well handled",
    "great choice", "good decision", "correct", "good move", "great", "nicely",
    "pushing back", "asking the right", "staying calm", "good instinct",
  ];
  const negative = [
    "be careful", "careful", "don't", "shouldn't", "should not", "avoid",
    "stop", "warning", "danger", "sensitive", "never share", "never give",
    "remove", "delete", "watch out", "caution", "risky", "hanging up",
    "do not share", "do not give", "protect yourself",
  ];

  if (positive.some((w) => lower.includes(w))) return "positive";
  if (negative.some((w) => lower.includes(w))) return "warning";
  return "neutral";
}