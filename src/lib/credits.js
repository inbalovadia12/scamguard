import { base44 } from "@/api/base44Client";

export const PLAN_LIMITS = {
  free: 10,
  premium: 100,
};

export const PREMIUM_FEATURES = [
  "100 AI analyses per month (vs 10 on free)",
  "ScamGuard Chrome Extension access",
  "Image upload & screenshot analysis",
  "AI Agent chat for real-time help",
  "Unlimited family members protected",
  "Real-time guardian alerts",
  "Priority scam pattern updates",
  "Detailed educational content",
  "Auto-redaction of phone numbers & wallets",
  "Personalized risk profiles",
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
    isPremium: plan === "premium",
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

export async function activatePremium() {
  await base44.auth.updateMe({
    subscription_plan: "premium",
    subscription_status: "active",
    credits_used: 0,
    credits_reset_month: new Date().toISOString().slice(0, 7),
  });
}