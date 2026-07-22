import { base44 } from "@/api/base44Client";

export const CREDIT_COSTS = {
  MESSAGE: 3,
  URL_SCAN: 12,
  IMAGE_UPLOAD: 8,
  AGENT_CHAT: 2,
  IMAGE_SCAN: 10,
  NEGOTIATOR: 3,
  IDENTITY_EXPOSURE: 35,
  CALL_CHUNK: 1,
};

export const PLAN_LIMITS = {
  starter: 15,
  plus: 150,
  premium: 400,
};

export const PLAN_PRICES = {
  starter: 0,
  plus: 59,
  premium: 119,
};

export const PLAN_NAMES = {
  starter: "Starter",
  plus: "Plus",
  premium: "Premium",
};

export const PLAN_FAMILY_LIMITS = {
  starter: 1,
  plus: 5,
  premium: Infinity,
};

export const LOW_CREDIT_THRESHOLD = 0.2;

export const PLAN_FEATURES = {
  starter: [
    "15 AI credits per month (~5 analyses)",
    "12 scam categories (SMS, email, crypto & more)",
    "Risk scores & plain-English explanations",
    "1 protected family member",
  ],
  plus: [
    "Everything in Starter, plus:",
    "150 AI credits per month (~50 analyses)",
    "URL & link scanning with live web checks",
    "Marketplace listing analysis (eBay, Amazon, Etsy & more)",
    "AI explanations & tactic breakdowns",
    "Image upload & screenshot analysis",
    "AI Agent chat",
    "5 protected family members",
    "Guardian email alerts",
    "Priority support",
  ],
  premium: [
    "Everything in Plus, plus:",
    "400 AI credits per month (~133 analyses)",
    "Unlimited family members",
    "Full analytics dashboard with trends",
    "CSV export of your analysis history",
    "Premium Learning Center with interactive lessons",
    "Faster processing priority",
    "Early access to new features",
  ],
};

export async function getCreditStatus() {
  const user = await base44.auth.me();
  let plan = user.subscription_plan || "starter";
  if (plan === "free") plan = "starter";
  if (plan === "elite") plan = "premium";
  const currentMonth = new Date().toISOString().slice(0, 7);

  let creditsUsed = user.credits_used || 0;
  const resetMonth = user.credits_reset_month;

  if (resetMonth !== currentMonth) {
    creditsUsed = 0;
    await base44.auth.updateMe({
      credits_used: 0,
      credits_reset_month: currentMonth,
    });
  }

  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  const remaining = Math.max(0, limit - creditsUsed);
  const lowThreshold = Math.ceil(limit * LOW_CREDIT_THRESHOLD);

  return {
    plan,
    creditsUsed,
    limit,
    remaining,
    canAnalyze: remaining > 0,
    isPaid: plan === "plus" || plan === "premium",
    isPremium: plan === "plus" || plan === "premium",
    isPremiumPlan: plan === "premium",
    lowCredit: remaining > 0 && remaining <= lowThreshold,
    lowThreshold,
  };
}

export async function getFamilyStatus() {
  const user = await base44.auth.me();
  let plan = user.subscription_plan || "starter";
  if (plan === "free") plan = "starter";
  if (plan === "elite") plan = "premium";
  const seniors = await base44.entities.ProtectedSenior.filter({ guardian_id: user.id });
  const limit = PLAN_FAMILY_LIMITS[plan] ?? PLAN_FAMILY_LIMITS.starter;
  return {
    plan,
    count: seniors.length,
    limit,
    canAddMore: seniors.length < limit,
  };
}

export async function incrementCreditUsage(amount = 1) {
  const user = await base44.auth.me();
  const currentMonth = new Date().toISOString().slice(0, 7);
  let creditsUsed = (user.credits_used || 0) + amount;
  const resetMonth = user.credits_reset_month;

  if (resetMonth !== currentMonth) {
    creditsUsed = amount;
  }

  await base44.auth.updateMe({
    credits_used: creditsUsed,
    credits_reset_month: currentMonth,
  });

  return creditsUsed;
}

export function getCachedAnalysis(input) {
  try {
    const key = `vardin_cache_${btoa(unescape(encodeURIComponent(input))).slice(0, 40)}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > 86400000) {
      localStorage.removeItem(key);
      return null;
    }
    return { ...data.result, _cached: true };
  } catch {
    return null;
  }
}

export function cacheAnalysis(input, result) {
  try {
    const key = `vardin_cache_${btoa(unescape(encodeURIComponent(input))).slice(0, 40)}`;
    localStorage.setItem(key, JSON.stringify({ result, timestamp: Date.now() }));
  } catch {
    // localStorage might be full or unavailable
  }
}

export async function startPaypalCheckout(planName) {
  const response = await base44.functions.invoke("createPaypalSubscription", { plan: planName });
  if (response.data?.error) {
    throw new Error(response.data.error);
  }
  const approvalUrl = response.data?.approval_url;
  if (!approvalUrl) {
    throw new Error("No approval URL received from PayPal");
  }
  window.location.href = approvalUrl;
}

export const CREDIT_PACKS = {
  small: { credits: 50, price: "5.00", displayPrice: "$5", name: "50 Credits" },
  medium: { credits: 150, price: "12.00", displayPrice: "$12", name: "150 Credits", popular: true },
  large: { credits: 300, price: "20.00", displayPrice: "$20", name: "300 Credits" },
};

export async function startCreditPurchase(packKey) {
  const response = await base44.functions.invoke("createCreditPurchase", { pack: packKey });
  if (response.data?.error) throw new Error(response.data.error);
  const approvalUrl = response.data?.approval_url;
  if (!approvalUrl) throw new Error("No approval URL received from PayPal");
  window.location.href = approvalUrl;
}

export async function captureCreditPurchase(orderId) {
  const response = await base44.functions.invoke("captureCreditPurchase", { order_id: orderId });
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}