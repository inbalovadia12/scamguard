export const PLAN_LIMITS: Record<string, number> = { starter: 30, plus: 350, premium: 500 };

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

// Server-side authoritative credit check + charge. Reads the user via
// asServiceRole to prevent client-side reset attacks (updateMe writing
// credits_used: 0), and writes via asServiceRole so the user token cannot
// interfere. Returns { ok, remaining?, limit?, error? }.
export async function serverSideCreditCharge(base44: any, user: any, cost: number) {
  const authUser = await base44.asServiceRole.entities.User.get(user.id);
  const available = getAvailableCredits(authUser);
  if (available.remaining < cost) {
    return { ok: false, error: { error: 'Insufficient credits', credits_remaining: available.remaining, credits_limit: getMonthlyCreditLimit(authUser), credit_cost: cost } };
  }
  const usage = applyCreditUsage(authUser, cost);
  if (!usage) {
    return { ok: false, error: { error: 'Credit balance changed during analysis. Please try again.' } };
  }
  await base44.asServiceRole.entities.User.update(user.id, usage);
  const remaining = getAvailableCredits({ ...authUser, ...usage }).remaining;
  return { ok: true, remaining, limit: getMonthlyCreditLimit(authUser) };
}

// Atomic credit charge using the CreditLedger entity. Creates a ledger
// record (atomic), aggregates the month's usage, and verifies the total
// doesn't exceed the user's limit. If it does, the record is deleted and
// the charge is reversed. This prevents the race condition where concurrent
// requests all read the same stale User snapshot and overspend.
//
// The charge happens BEFORE the paid API call. If the API call fails, the
// caller MUST call refundCreditCharge(base44, charge.ledger_id) to reverse
// the charge.
export async function atomicCreditCharge(base44: any, userId: string, cost: number) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Read the user to get plan, referral bonus, and admin credit balance
  const authUser = await base44.asServiceRole.entities.User.get(userId);
  const monthlyLimit = getMonthlyCreditLimit(authUser);
  const adminBalance = Math.max(0, Number(authUser.admin_credit_balance) || 0);

  // Create a ledger record (atomic — no race condition on creation)
  const ledger = await base44.asServiceRole.entities.CreditLedger.create({
    user_id: userId,
    amount: cost,
    month: currentMonth,
    type: 'usage',
  });

  // Sum the total usage for this user this month. The backend runtime does not
  // expose aggregate on either client, so we filter and sum in JS. The record
  // count is bounded by the user's monthly credit limit (max ~500), so a single
  // filter call is sufficient. filter without options returns an array, which
  // is the pattern used elsewhere in the codebase for asServiceRole.entities.
  const usageRecords = await base44.asServiceRole.entities.CreditLedger.filter({
    user_id: userId,
    month: currentMonth,
    type: 'usage',
  });
  const totalUsage = (Array.isArray(usageRecords) ? usageRecords : [])
    .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

  // Check if the total usage exceeds the limit
  if (totalUsage > monthlyLimit + adminBalance) {
    // Over the limit — reverse the charge
    await base44.asServiceRole.entities.CreditLedger.delete(ledger.id);
    const remaining = Math.max(0, monthlyLimit + adminBalance - (totalUsage - cost));
    return {
      ok: false,
      error: {
        error: 'Insufficient credits',
        credits_remaining: remaining,
        credits_limit: monthlyLimit,
        credit_cost: cost,
      },
    };
  }

  const remaining = Math.max(0, monthlyLimit + adminBalance - totalUsage);

  // Best-effort: sync the User entity's credits_used for display purposes.
  // This may race, but the ledger is the source of truth.
  try {
    await base44.asServiceRole.entities.User.update(userId, {
      credits_used: totalUsage,
      credits_reset_month: currentMonth,
    });
  } catch {}

  return { ok: true, remaining, limit: monthlyLimit, ledger_id: ledger.id };
}

// Reverses a credit charge by deleting the ledger record. Call this if the
// paid API call fails after a successful atomicCreditCharge.
export async function refundCreditCharge(base44: any, ledgerId: string) {
  try {
    await base44.asServiceRole.entities.CreditLedger.delete(ledgerId);
  } catch {}
}