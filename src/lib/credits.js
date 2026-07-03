import { base44 } from "@/api/base44Client";

export const PLAN_LIMITS = {
  free: 10,
  plus: 100,
  premium: 100,
  elite: 250,
};

export const PLAN_PRICES = {
  free: 0,
  plus: 40,
  premium: 80,
  elite: 120,
};

export const PLAN_NAMES = {
  free: "Free",
  plus: "Plus",
  premium: "Premium",
  elite: "Elite",
};

export const PLAN_FEATURES = {
  free: [
    "10 AI scam analyses per month",
    "Text message analysis",
    "Risk score & explanation",
    "Basic next steps",
    "1 protected family member",
  ],
  plus: [
    "Everything in Free, plus:",
    "100 AI analyses per month",
    "Chrome Extension access",
    "Image upload & screenshots",
    "AI Agent chat",
    "5 protected family members",
    "Real-time guardian alerts",
  ],
  premium: [
    "Everything in Plus, plus:",
    "Auto-redaction of phone numbers & wallets",
    "Personalized risk profile summary",
    "Detailed educational content per analysis",
    "CSV export of analysis history",
  ],
  elite: [
    "Everything in Premium, plus:",
    "250 AI analyses per month",
    "Unlimited protected family members",
    "Advanced analytics dashboard",
    "Scam trend reports & insights",
    "Priority support",
    "Unlimited CSV/PDF exports",
  ],
};

export async function getCreditStatus() {
  const user = await base44.auth.me();
  const plan = user.subscription_plan || "free";
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

  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const remaining = Math.max(0, limit - creditsUsed);

  return {
    plan,
    creditsUsed,
    limit,
    remaining,
    canAnalyze: remaining > 0,
    isPremium: plan === "premium" || plan === "elite" || plan === "plus",
    isElite: plan === "elite",
  };
}

export async function incrementCreditUsage() {
  const user = await base44.auth.me();
  const currentMonth = new Date().toISOString().slice(0, 7);
  let creditsUsed = (user.credits_used || 0) + 1;
  const resetMonth = user.credits_reset_month;

  if (resetMonth !== currentMonth) {
    creditsUsed = 1;
  }

  await base44.auth.updateMe({
    credits_used: creditsUsed,
    credits_reset_month: currentMonth,
  });

  return creditsUsed;
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

export async function activatePremium() {
  await startPaypalCheckout("premium");
}