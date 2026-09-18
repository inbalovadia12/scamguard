// Centralized family-member pricing (backend mirror of src/lib/planPricing.js).
// Keep these values in sync with the frontend config.
export const FAMILY_PRICING = {
  addonAnnual: 24,
  plans: {
    starter: { baseAnnual: 0, includedMembers: 1, maxMembers: 1 },
    plus: { baseAnnual: 75, includedMembers: 1, maxMembers: 10 },
    premium: { baseAnnual: 149, includedMembers: 1, maxMembers: 10 },
  } as Record<string, { baseAnnual: number; includedMembers: number; maxMembers: number }>,
};

export function computeFamilyTotal(plan: string, totalMembers: number) {
  const p = FAMILY_PRICING.plans[plan] || FAMILY_PRICING.plans.starter;
  const members = Math.max(p.includedMembers, Math.min(totalMembers || p.includedMembers, p.maxMembers));
  const additional = Math.max(0, members - p.includedMembers);
  const totalAnnual = p.baseAnnual + additional * FAMILY_PRICING.addonAnnual;
  return { members, additional, totalAnnual };
}

// Normalize plan aliases to the canonical three plans.
export function normalizePlan(plan: string | undefined | null): string {
  if (plan === 'free' || !plan) return 'starter';
  if (plan === 'elite') return 'premium';
  return plan;
}

// Legacy fallback limits for existing subscribers who subscribed before the
// current pricing model (no family_members_paid recorded on their account).
export const LEGACY_FAMILY_LIMITS: Record<string, number> = {
  starter: 1,
  plus: 5,
  premium: Infinity,
};

// Resolve the member limit for a user from the backend. Uses their admin-set
// family_members_paid if present; otherwise falls back to legacy limits.
export function resolveFamilyLimitBackend(plan: string, user: any): number {
  const paid = user?.family_members_paid;
  if (paid != null && !Number.isNaN(paid)) return paid;
  return LEGACY_FAMILY_LIMITS[plan] ?? FAMILY_PRICING.plans[plan]?.includedMembers ?? 1;
}

export function planDisplayName(plan: string): string {
  return ({ starter: 'Starter', plus: 'Plus', premium: 'Premium' } as Record<string, string>)[plan] || 'Starter';
}