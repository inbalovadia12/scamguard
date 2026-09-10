export const PLAN_LIMITS: Record<string, number> = { starter: 30, plus: 250, premium: 500 };

export function normalizePlan(plan: string | undefined) {
  if (plan === "free" || !plan) return "starter";
  if (plan === "elite") return "premium";
  return plan;
}

export function getMonthlyCreditLimit(user: any) {
  const plan = normalizePlan(user.subscription_plan);
  return (PLAN_LIMITS[plan] || PLAN_LIMITS.starter) + (Number(user.referral_bonus_credits) || 0);
}

export function getAvailableCredits(user: any) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const creditsUsed = user.credits_reset_month === currentMonth ? (Number(user.credits_used) || 0) : 0;
  const adminBalance = Math.max(0, Number(user.admin_credit_balance) || 0);
  const monthlyRemaining = Math.max(0, getMonthlyCreditLimit(user) - creditsUsed);
  return { creditsUsed, adminBalance, monthlyRemaining, remaining: monthlyRemaining + adminBalance };
}

export function applyCreditUsage(user: any, amount: number) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  let creditsUsed = user.credits_reset_month === currentMonth ? (Number(user.credits_used) || 0) : 0;
  let adminBalance = Math.max(0, Number(user.admin_credit_balance) || 0);
  const remaining = Math.max(0, getMonthlyCreditLimit(user) - creditsUsed + adminBalance);
  if (remaining < amount) return null;
  const fromAdmin = Math.min(adminBalance, amount);
  adminBalance -= fromAdmin;
  creditsUsed += amount - fromAdmin;
  return { credits_used: creditsUsed, admin_credit_balance: adminBalance, credits_reset_month: currentMonth };
}
