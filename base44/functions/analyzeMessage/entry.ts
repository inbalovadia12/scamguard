import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from "../../shared/credits.ts";

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
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number", description: "0-100" },
    explanation: { type: "string" },
    tactics_detected: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    why_scammers_do_this: { type: "string" },
    what_they_want: { type: "string" },
    what_to_say: { type: "string" },
  },
  required: ["risk_level", "risk_score", "explanation"],
};

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
    return `You are Vardin, an AI scam detection assistant. Analyze this entire conversation as a whole to detect patterns, escalation, grooming, repeated requests, inconsistencies, information harvesting, isolation, and unrealistic promises.\n\nConversation:\n"""\n${text.slice(0, 10000)}\n"""\n\nReturn a structured assessment with overall risk, risk score 0-100, patterns detected, suspicious messages and why they are suspicious, escalation summary, what the other party wants, recommended actions, and a concise summary. Never claim certainty when the evidence is ambiguous. Respond in ${languageName}.`;
  }

  if (mode === "incognito_phone") {
    return `You are a phone number reputation analyst. Research this phone number: ${text.slice(0, 100)}. Check scam reports, robocall/spam reports, and other high-signal public sources. Do not invent reports or URLs. Return country, carrier, reputation_score (0-100, 0=safe), risk_level, user_reports, scam_categories, summary, and sources. Respond in ${languageName}.`;
  }

  if (mode === "incognito_image") {
    return `You are a reverse-image scam detection analyst. Analyze the uploaded image for scam indicators. Check whether it appears elsewhere online, including stock photos, social media, or scam reports. Only report verifiable findings. Return risk_level, risk_score, is_likely_scam_profile, explanation, similar_images_found, sources, and red_flags. Respond in ${languageName}.`;
  }

  if (mode === "crypto_investment") {
    return `Scam detection expert: analyze this crypto investment/giveaway message for scam risk.\nMessage: "${text.slice(0, 10000)}"\n\nCRITICAL ANTI-FALSE-POSITIVE RULES:\n1. A legitimate crypto/investment platform invitation, promotional credit offer, referral bonus, or account notification is NOT a scam. Words like "crypto", "reward", "bonus", "invite", "investment", "promotion" are NOT scam indicators on their own — legitimate exchanges and platforms use them constantly.\n2. Require MULTIPLE MEANINGFUL scam indicators before a "high" verdict: an actual request to SEND funds to an unknown wallet, a demand to connect a wallet to a suspicious site (drainer), a fake giveaway matching real brands with a send-to-claim pattern, unrealistic guaranteed returns combined with urgency, or impersonation of a real person/brand.\n3. If the message is a normal promotional email/SMS from a real business with no request to send money, connect a wallet, share a seed phrase, or click a suspicious link, the risk is LOW.\n4. Verification links and login confirmations sent by the platform ITSELF in response to the user's own action are NOT scams.\n5. Lower confidence when the message has normal business context (sender domain, professional tone, no urgency/threats) and does NOT request: money transfers, wallet connections, seed phrases, passwords, remote access, or secrecy.\n\nNever say "definitely a scam"; use "likely" when appropriate. Identify concrete tactics: wallet-drainer links, send-to-claim giveaways, impersonation, unrealistic returns + urgency. Return a risk score 0-100 that matches the risk level and reflects the actual danger — a promotional email with no fund request should score low, not high.`;
  }

  return `Scam detection expert: analyze this ${messageType || "message"} for scam risk.\nMessage: "${text.slice(0, 10000)}"\n\nCRITICAL ANTI-FALSE-POSITIVE RULES:\n1. Words like "crypto", "reward", "invite", "verification", "promotion", "bonus", "gift", "prize", "investment", "account", "security", "verify", "confirm" are NOT scam indicators on their own. Legitimate businesses use these words constantly in normal communications. Flag the underlying BEHAVIOR, not the vocabulary.\n2. Legitimate financial promotions, investment-platform invitations, account-security notifications, promotional credit offers, and normal verification links (e.g., a bank sending a code to confirm your own login) are NOT scams. If the message has normal business context and does NOT request money, passwords, recovery phrases, remote access, or unusual secrecy, the risk is LOW.\n3. Require MULTIPLE MEANINGFUL scam indicators or clear evidence of fraud before a "high" verdict. Look for combinations: urgency + payment demand, authority impersonation + credential request, secrecy + remote access, fake brand + send-to-claim pattern. A single ambiguous keyword is NOT enough.\n4. Lower confidence when the message has normal business context (sender domain, professional tone, no urgency/threats) and does NOT request: money, passwords, recovery phrases, remote access, or secrecy.\n\nNever say "definitely a scam"; use "likely" when appropriate. Plain English and educational. Identify manipulation tactics such as urgency, authority impersonation, scarcity, love bombing, payment red flags, and credential requests — but only when the BEHAVIOR is present, not just the vocabulary. Give concrete next steps. Return a risk score 0-100 that matches the risk level and reflects the actual danger — a normal business notification should score low.`;
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