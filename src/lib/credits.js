import { base44 } from "@/api/base44Client";

export const PLAN_LIMITS = {
  starter: 10,
  plus: 100,
  premium: 250,
};

export const PLAN_PRICES = {
  starter: 0,
  plus: 40,
  premium: 80,
};

export const PLAN_NAMES = {
  starter: "Starter",
  plus: "Plus",
  premium: "Premium",
};

export const PLAN_FEATURES = {
  starter: [
    "10 AI analyses per month",
    "Basic risk scores",
    "Community reports access",
    "Individual use only",
  ],
  plus: [
    "Everything in Starter, plus:",
    "100 AI analyses per month",
    "AI explanations & tactic breakdowns",
    "Advanced scam detection engine",
    "Email & SMS analysis",
    "Marketplace protection checks",
    "Chrome Extension access",
    "Image upload & screenshot analysis",
    "AI Agent chat",
    "5 protected family members",
    "Priority support",
  ],
  premium: [
    "Everything in Plus, plus:",
    "250 AI analyses per month",
    "Complete family protection system",
    "Shared family scam alerts",
    "Unlimited family members",
    "Advanced AI models",
    "Screenshot & QR code analysis",
    "Early access to new features",
    "Premium analytics dashboard",
    "Faster processing priority",
    "Unlimited CSV exports",
  ],
};

export async function getCreditStatus() {
  const user = await base44.auth.me();
  let plan = user.subscription_plan || "starter";
  // Migrate old plan names
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

  return {
    plan,
    creditsUsed,
    limit,
    remaining,
    canAnalyze: remaining > 0,
    isPaid: plan === "plus" || plan === "premium",
    isPremium: plan === "plus" || plan === "premium",
    isPremiumPlan: plan === "premium",
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