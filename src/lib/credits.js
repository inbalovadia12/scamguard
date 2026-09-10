import { base44 } from "@/api/base44Client";
import { resolveFamilyLimit } from "@/lib/planPricing";

export const CREDIT_COSTS = {
  MESSAGE: 3,
  URL_SCAN: 7,
  IMAGE_UPLOAD: 8,
  AGENT_CHAT: 2,
  IMAGE_SCAN: 8,
  NEGOTIATOR: 3,
  IDENTITY_EXPOSURE: 35,
  CALL_CHUNK: 1,
  SCREEN_CAPTURE: 5,
  CONVERSATION_ANALYSIS: 5,
};

export const PLAN_LIMITS = {
  starter: 30,
  plus: 350,
  premium: 500,
};

export const PLAN_PRICES = {
  starter: 0,
  plus: 75,
  premium: 149,
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
    "30 AI credits per month",
    "Message Check with all supported message types",
    "Vardin AI Assistant",
    "Basic risk scores & plain-English explanations",
  ],
  plus: [
    "Everything in Starter, plus:",
    "350 AI credits per month",
    "Crypto link & investment message scanning",
    "URL & link scanning with live web checks",
    "Phone number lookup & caller check",
    "Conversation analyzer",
    "Scam Exposer for marketplace deals",
    "Marketplace listing analysis",
    "AI tactic breakdowns",
    "Analytics dashboard & CSV export",
    "Incognito Search",
    "1 member included · add more at $2/mo each",
    "Guardian email alerts",
    "Priority support",
  ],
  premium: [
    "Everything in Plus, plus:",
    "500 AI credits per month",
    "Universal Scanner — pages, QR, files & advanced web analysis",
    "Live Guard — real-time call & screen monitoring",
    "Local Scam Intelligence — location-based threat research",
    "Browser Extension",
    "Image Scanner",
    "Learning Center & interactive lessons",
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

  const limit = (PLAN_LIMITS[plan] || PLAN_LIMITS.starter) + (user.referral_bonus_credits || 0);
  const adminCreditBalance = Math.max(0, user.admin_credit_balance || 0);
  // `credits_used` records real usage and can legitimately be higher than the
  // current plan limit after an admin changes a user from a larger plan to a
  // smaller one. Never let that historical number make the UI look broken.
  // Monthly allowance and admin-granted bonus credits are separate buckets.
  const monthlyRemaining = Math.max(0, limit - creditsUsed);
  const remaining = monthlyRemaining + adminCreditBalance;
  const displayedCreditsUsed = Math.min(creditsUsed, limit);
  const lowThreshold = Math.ceil(limit * LOW_CREDIT_THRESHOLD);

  return {
    plan,
    // Keep the public usage display within the current plan's allowance.
    // The raw value remains available for diagnostics/history if needed.
    creditsUsed: displayedCreditsUsed,
    rawCreditsUsed: creditsUsed,
    limit,
    monthlyRemaining,
    remaining,
    canAnalyze: remaining > 0,
    isPaid: plan === "plus" || plan === "premium",
    isPremium: plan === "plus" || plan === "premium",
    isPremiumPlan: plan === "premium",
    lowCredit: remaining > 0 && monthlyRemaining <= lowThreshold,
    adminCreditBalance,
    lowThreshold,
  };
}

export async function getFamilyStatus() {
  const user = await base44.auth.me();
  let plan = user.subscription_plan || "starter";
  if (plan === "free") plan = "starter";
  if (plan === "elite") plan = "premium";
  const seniors = await base44.entities.ProtectedSenior.filter({ guardian_id: user.id });
  const { limit } = resolveFamilyLimit(plan, user);
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
  const resetMonth = user.credits_reset_month;
  let creditsUsed = resetMonth === currentMonth ? (user.credits_used || 0) : 0;

  const adminBalance = Math.max(0, user.admin_credit_balance || 0);
  const fromAdmin = Math.min(adminBalance, amount);
  const fromMonthly = amount - fromAdmin;
  await base44.auth.updateMe({
    credits_used: creditsUsed + fromMonthly,
    admin_credit_balance: adminBalance - fromAdmin,
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

export async function startPaypalCheckout(planName, members) {
  const response = await base44.functions.invoke("createPaypalSubscription", { plan: planName, members });
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