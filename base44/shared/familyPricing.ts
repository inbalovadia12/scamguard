// Centralized family-member pricing (backend mirror of src/lib/planPricing.js).
// Keep these values in sync with the frontend config.
export const FAMILY_PRICING = {
  addonAnnual: 24,
  plans: {
    starter: { baseAnnual: 0, includedMembers: 1, maxMembers: 1 },
    plus: { baseAnnual: 59, includedMembers: 1, maxMembers: 10 },
    premium: { baseAnnual: 119, includedMembers: 1, maxMembers: 10 },
  } as Record<string, { baseAnnual: number; includedMembers: number; maxMembers: number }>,
};

export function computeFamilyTotal(plan: string, totalMembers: number) {
  const p = FAMILY_PRICING.plans[plan] || FAMILY_PRICING.plans.starter;
  const members = Math.max(p.includedMembers, Math.min(totalMembers || p.includedMembers, p.maxMembers));
  const additional = Math.max(0, members - p.includedMembers);
  const totalAnnual = p.baseAnnual + additional * FAMILY_PRICING.addonAnnual;
  return { members, additional, totalAnnual };
}