import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from "../../shared/credits.ts";
import { matchKnownLegitimateDomain } from "../../shared/legitimateDomains.ts";

const CREDIT_COSTS: Record<string, number> = {
  message: 3,
  crypto_investment: 3,
  bulk_message: 3,
  conversation: 5,
  incognito_message: 3,
  incognito_image: 8,
  incognito_phone: 5,
  incognito_conversation: 5,
};

const REQUIRED_PLANS: Record<string, "starter" | "plus"> = {
  message: "starter",
  crypto_investment: "plus",
  bulk_message: "plus",
  conversation: "plus",
  incognito_message: "plus",
  incognito_image: "plus",
  incognito_phone: "plus",
  incognito_conversation: "plus",
};

const DEFAULT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["SCAM", "LIKELY SCAM", "NOT A SCAM", "UNCERTAIN"] },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number", description: "0-100" },
    explanation: { type: "string" },
    tactics_detected: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    why_scammers_do_this: { type: "string" },
    what_they_want: { type: "string" },
    what_to_say: { type: "string" },
  },
  required: ["verdict", "risk_level", "risk_score", "explanation"],
};

// Shared four-verdict instructions embedded in every scam-analysis prompt.
const VERDICT_BLOCK = `VERDICT SYSTEM — choose EXACTLY ONE verdict for this message:
- "NOT A SCAM": No meaningful evidence of fraud. This includes normal business messages that mention money, crypto, promotions, invitations, verification, rewards, account security, or contain links — as long as they do NOT request payment-to-receive-money, recovery phrases/passwords, impersonate someone, make deceptive claims, use suspicious URLs, promise unrealistic guarantees, or apply strong pressure tactics.
- "UNCERTAIN": Mixed or ambiguous signals; not enough evidence to call it a scam but something is off and worth verifying independently.
- "LIKELY SCAM": One or more concrete scam indicators are present (e.g., payment-to-receive-money, recovery phrase/password request, impersonation, suspicious URL, unrealistic guarantee, strong pressure) but not fully confirmed.
- "SCAM": Multiple strong, concrete scam indicators are clearly present (e.g., impersonation + urgency + payment demand, a wallet-drainer link, a send-to-claim giveaway, a demand for gift cards / crypto / remote access).

CRITICAL — DO NOT BIAS TOWARD DETECTING SCAMS:
- You are allowed and expected to return "NOT A SCAM" when the evidence supports that conclusion. Most messages are not scams.
- A message asking the user to sign up, verify an account, click a link, or mentioning money is NOT automatically a scam.
- Words like "crypto", "reward", "invite", "verification", "promotion", "bonus", "gift", "prize", "investment", "account", "security", "verify", "confirm" are NOT scam indicators on their own. Legitimate businesses use them constantly. Flag the underlying BEHAVIOR, not the vocabulary.
- Legitimate financial promotions, investment-platform invitations, account-security notifications, promotional credit offers, and normal verification links (e.g., a bank sending a code to confirm your own login) are NOT scams when they do not request money, passwords, recovery phrases, remote access, or secrecy.
- Only classify as SCAM or LIKELY SCAM when there are concrete indicators: requests for payment to receive money, recovery phrases/passwords, impersonation, deceptive claims, suspicious URLs, unrealistic guarantees, or strong pressure tactics.

Map verdict to risk_level and risk_score consistently:
- NOT A SCAM → risk_level "low", risk_score 0-20
- UNCERTAIN → risk_level "low" or "medium", risk_score 20-45
- LIKELY SCAM → risk_level "medium", risk_score 45-75
- SCAM → risk_level "high", risk_score 75-100

NO FABRICATION: Only report scam indicators, red flags, tactics, or "what they want" that are directly and explicitly present in the supplied message. Never invent a scam scenario, attacker, urgency, payment demand, credential request, impersonation, or other evidence that is not actually in the text. If the message is a normal/legitimate business or personal message with no concrete scam indicators, return verdict "NOT A SCAM", risk_level "low", a low risk_score, and leave tactics_detected, why_scammers_do_this, what_they_want, and what_to_say EMPTY. Do not generate generic educational scam content for benign messages.`;

function normalizePlan(plan: string | undefined) {
  if (!plan || plan === "free") return "starter";
  if (plan === "elite") return "premium";
  return plan;
}

function planRank(plan: string) {
  return plan === "premium" ? 2 : plan === "plus" ? 1 : 0;
}

function buildPrompt(mode: string, text: string, messageType?: string, language?: string) {
  const languageName = ({ en: "English", he: "Hebrew", es: "Spanish" } as Record<string, string>)[language || "en"] || "English";
  if (mode === "conversation" || mode === "incognito_conversation") {
    return `You are Vardin, an AI scam detection assistant. Analyze this entire conversation as a whole to detect patterns, escalation, grooming, repeated requests, inconsistencies, information harvesting, isolation, and unrealistic promises.\n\nConversation:\n"""\n${text.slice(0, 10000)}\n"""\n\n${VERDICT_BLOCK}\n\nReturn a structured assessment with: verdict (exactly one of the four), overall risk level, risk score 0-100, patterns detected, suspicious messages and why they are suspicious, escalation summary, what the other party wants, recommended actions, and a concise summary. Never claim certainty when the evidence is ambiguous. If the conversation is a normal business or personal exchange with no concrete scam indicators, return "NOT A SCAM". Respond in ${languageName}.`;
  }

  if (mode === "incognito_phone") {
    return `You are a phone number reputation analyst. Research this phone number: ${text.slice(0, 100)}. Check scam reports, robocall/spam reports, and other high-signal public sources. Do not invent reports or URLs. Return country, carrier, reputation_score (0-100, 0=safe), risk_level, user_reports, scam_categories, summary, and sources. Respond in ${languageName}.`;
  }

  if (mode === "incognito_image") {
    return `You are a reverse-image scam detection analyst. Analyze the uploaded image for scam indicators. Check whether it appears elsewhere online, including stock photos, social media, or scam reports. Only report verifiable findings. Return risk_level, risk_score, is_likely_scam_profile, explanation, similar_images_found, sources, and red_flags. Respond in ${languageName}.`;
  }

  if (mode === "crypto_investment") {
    return `Scam detection expert: analyze this crypto investment/giveaway message for scam risk.\nMessage: "${text.slice(0, 10000)}"\n\n${VERDICT_BLOCK}\n\nADDITIONAL CRYPTO CONTEXT:\n- A legitimate crypto/investment platform invitation, promotional credit offer, referral bonus, or account notification is NOT a scam. Words like "crypto", "reward", "bonus", "invite", "investment", "promotion" are NOT scam indicators on their own — legitimate exchanges and platforms use them constantly.\n- Concrete crypto scam indicators: an actual request to SEND funds to an unknown wallet, a demand to connect a wallet to a suspicious site (drainer), a fake giveaway matching real brands with a send-to-claim pattern, unrealistic guaranteed returns combined with urgency, or impersonation of a real person/brand.\n- Verification links and login confirmations sent by the platform ITSELF in response to the user's own action are NOT scams.\n- If the message is a normal promotional email/SMS from a real business with no request to send money, connect a wallet, share a seed phrase, or click a suspicious link, the verdict is "NOT A SCAM".\n\nIdentify concrete tactics when present: wallet-drainer links, send-to-claim giveaways, impersonation, unrealistic returns + urgency. Never say "definitely a scam"; use "likely" (LIKELY SCAM) when appropriate. Return a risk_score 0-100 consistent with your verdict.`;
  }

  return `Scam detection expert: analyze this ${messageType || "message"} for scam risk.\nMessage: "${text.slice(0, 10000)}"\n\n${VERDICT_BLOCK}\n\nADDITIONAL GUIDANCE:\n- Flag the underlying BEHAVIOR, not the vocabulary. A message with normal business context (sender domain, professional tone, no urgency/threats) that does NOT request money, passwords, recovery phrases, remote access, or secrecy is "NOT A SCAM".\n- For SCAM or LIKELY SCAM, require concrete indicators: payment-to-receive-money, recovery phrases/passwords, impersonation, deceptive claims, suspicious URLs, unrealistic guarantees, or strong pressure tactics. Look for combinations: urgency + payment demand, authority impersonation + credential request, secrecy + remote access, fake brand + send-to-claim pattern.\n- Never say "definitely a scam"; use "likely" (LIKELY SCAM) when appropriate. Plain English and educational. Give concrete next steps. Return a risk_score 0-100 consistent with your verdict — a normal business notification should score low.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

      const body = await req.json();
    const mode = String(body.mode || "");
    const text = String(body.text || "").trim();
    const messageType = typeof body.message_type === "string" ? body.message_type : undefined;
    const language = typeof body.language === "string" ? body.language : "en";
    const fileUrls = Array.isArray(body.file_urls) ? body.file_urls.filter((u) => typeof u === "string").slice(0, 2) : [];

    if (!CREDIT_COSTS[mode]) return Response.json({ error: "Invalid analysis mode" }, { status: 400 });
    if (!text) return Response.json({ error: "Message content is required" }, { status: 400 });
    if (mode === "incognito_image" && fileUrls.length === 0) {
      return Response.json({ error: "Image is required" }, { status: 400 });
    }

    const plan = normalizePlan(user.subscription_plan);
    let incognitoAllowed = false;
    if (mode.startsWith("incognito_")) {
      try {
        const protectedMembers = await base44.entities.ProtectedSenior.filter({ senior_user_id: user.id });
        incognitoAllowed = protectedMembers.some((member: any) => member.incognito_allowed === true);
      } catch {}
    }
    if (!incognitoAllowed && planRank(plan) < planRank(REQUIRED_PLANS[mode])) {
      return Response.json({ error: "Paid plan required", upgrade_url: "/pricing" }, { status: 403 });
    }

    const cost = CREDIT_COSTS[mode];
    const available = getAvailableCredits(user);
    if (available.remaining < cost) {
      return Response.json({
        error: "Insufficient credits",
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: cost,
      }, { status: 402 });
    }

    // If the submitted message is just a URL pointing to a known-legitimate
    // official domain, return a safe verdict directly. The LLM tends to frame
    // famous-brand URLs as brand-impersonation scams even when the domain is
    // the real official one.
    const trimmedText = text.trim();
    const isUrlInput = /^https?:\/\/\S+$/i.test(trimmedText) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(trimmedText);
    if (isUrlInput && (mode === "message" || mode === "bulk_message" || mode === "crypto_investment")) {
      const legitApex = matchKnownLegitimateDomain(trimmedText);
      if (legitApex) {
        const brand = legitApex.split(".")[0] || legitApex;
        const safeResult = {
          verdict: "NOT A SCAM",
          risk_level: "low",
          risk_score: 5,
          explanation: `This is the official ${brand} website (${legitApex}). No scam indicators present.`,
          tactics_detected: [],
          next_steps: [],
          why_scammers_do_this: "",
          what_they_want: "",
          what_to_say: "",
        };
        const usage = applyCreditUsage(user, cost);
        if (!usage) {
          return Response.json({ error: "Credit balance changed during analysis. Please try again." }, { status: 409 });
        }
        await base44.auth.updateMe(usage);
        const remaining = getAvailableCredits({ ...user, ...usage }).remaining;
        return Response.json({ result: safeResult, credits_used: cost, credits_remaining: remaining, credits_limit: getMonthlyCreditLimit(user) });
      }
    }

    const responseSchema = body.response_json_schema && typeof body.response_json_schema === "object"
      ? body.response_json_schema
      : DEFAULT_SCHEMA;

    const llmOptions: any = {
      prompt: buildPrompt(mode, text, messageType, language),
      response_json_schema: responseSchema,
      model: "gemini_3_flash",
    };
    if (fileUrls.length > 0) llmOptions.file_urls = fileUrls;
    if (["crypto_investment", "conversation", "incognito_conversation", "incognito_phone", "incognito_image"].includes(mode)) llmOptions.add_context_from_internet = true;

    const result = await base44.integrations.Core.InvokeLLM(llmOptions);

    // Guard against fabricated scam narratives on benign messages. Only fires
    // on a clear "NOT A SCAM" verdict — scam/uncertain detections are untouched.
    if (result && result.verdict === "NOT A SCAM") {
      result.tactics_detected = [];
      result.why_scammers_do_this = "";
      result.what_they_want = "";
      result.what_to_say = "";
      result.risk_level = "low";
    }

    const usage = applyCreditUsage(user, cost);
    if (!usage) {
      return Response.json({ error: "Credit balance changed during analysis. Please try again." }, { status: 409 });
    }
    await base44.auth.updateMe(usage);

    const remaining = getAvailableCredits({ ...user, ...usage }).remaining;
    return Response.json({ result, credits_used: cost, credits_remaining: remaining, credits_limit: getMonthlyCreditLimit(user) });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Analysis failed" }, { status: 500 });
  }
});