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

export const PREMIUM_FEATURES = [
  "100 AI scam analyses per month (vs 10 on free)",
  "ScamGuard Chrome Extension access",
  "Image upload & screenshot analysis",
  "AI Agent chat for real-time help",
  "Up to 5 protected family members",
  "Real-time guardian alerts",
  "Priority scam pattern updates",
  "Detailed educational content",
  "Auto-redaction of phone numbers & wallets",
  "Personalized risk profiles",
];

export const ELITE_FEATURES = [
  "250 AI scam analyses per month",
  "Everything in Premium, plus:",
  "Unlimited protected family members",
  "Advanced analytics dashboard",
  "Priority support (under 4hr response)",
  "Early access to experimental AI tools",
  "Advanced family collaboration features",
  "Unlimited CSV/PDF exports",
  "Custom risk thresholds & rules",
  "Exclusive scam trend reports",
];

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

export async function activatePlan(planName) {
  await base44.auth.updateMe({
    subscription_plan: planName,
    subscription_status: "active",
    credits_used: 0,
    credits_reset_month: new Date().toISOString().slice(0, 7),
  });
}

export async function activatePremium() {
  await activatePlan("premium");
}