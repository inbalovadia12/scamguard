import { base44 } from "@/api/base44Client";

export const CREDIT_COSTS = {
  MESSAGE: 1,
  URL_SCAN: 5,
  IMAGE_UPLOAD: 3,
};

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

export const PLAN_FAMILY_LIMITS = {
  starter: 1,
  plus: 5,
  premium: Infinity,
};

export const PLAN_FEATURES = {
  starter: [
    "10 AI analyses per month",
    "12 scam categories (SMS, email, crypto & more)",
    "Risk scores & plain-English explanations",
    "1 protected family member",
  ],
  plus: [
    "Everything in Starter, plus:",
    "100 AI analyses per month",
    "URL & link scanning with live web checks",
    "AI explanations & tactic breakdowns",
    "Image upload & screenshot analysis",
    "AI Agent chat",
    "Chrome Extension access",
    "5 protected family members",
    "Guardian email alerts",
    "Priority support",
  ],
  premium: [
    "Everything in Plus, plus:",
    "250 AI analyses per month",
    "Unlimited family members",
    "Full analytics dashboard with trends",
    "CSV export of your analysis history",
    "Faster processing priority",
    "Early access to new features",
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