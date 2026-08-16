// Centralized family-member pricing configuration.
// Change values here to adjust family-member pricing app-wide (UI + limits + billing).
// NOTE: The PayPal backend mirrors these values in base44/shared/familyPricing.ts — keep them in sync.
export const FAMILY_PRICING = {
  addonAnnual: 24, // extra cost per additional member per year (USD). $24/yr = $2/mo.
  plans: {
    starter: { baseAnnual: 0,   includedMembers: 1, maxMembers: 1 },
    plus:    { baseAnnual: 75,  includedMembers: 1, maxMembers: 10 },
    premium: { baseAnnual: 149, includedMembers: 1, maxMembers: 10 },
  },
};

// Fallback limits for existing subscribers who subscribed BEFORE this pricing model
// (no family_members_paid recorded on their account). Preserves their prior limit so
// their current subscriptions and already-added members are not broken.
export const LEGACY_FAMILY_LIMITS = {
  starter: 1,
  plus: 5,
  premium: Infinity,
};

export function getPlanPricing(plan) {
  return FAMILY_PRICING.plans[plan] || FAMILY_PRICING.plans.starter;
}

export function computeFamilyTotal(plan, totalMembers) {
  const p = getPlanPricing(plan);
  const members = Math.max(p.includedMembers, Math.min(totalMembers || p.includedMembers, p.maxMembers));
  const additional = Math.max(0, members - p.includedMembers);
  const baseAnnual = p.baseAnnual;
  const additionalCostAnnual = additional * FAMILY_PRICING.addonAnnual;
  const totalAnnual = baseAnnual + additionalCostAnnual;
  return {
    plan,
    members,
    includedMembers: p.includedMembers,
    maxMembers: p.maxMembers,
    additionalMembers: additional,
    baseAnnual,
    addonAnnual: FAMILY_PRICING.addonAnnual,
    additionalCostAnnual,
    totalAnnual,
    baseMonthly: baseAnnual / 12,
    addonMonthly: FAMILY_PRICING.addonAnnual / 12,
    totalMonthly: totalAnnual / 12,
  };
}

// Resolve the member limit for a user. Uses their paid member count if recorded;
// otherwise falls back to legacy limits so existing subscribers aren't broken.
export function resolveFamilyLimit(plan, user) {
  const paid = user?.family_members_paid;
  if (paid != null && !Number.isNaN(paid)) {
    return { limit: paid, paid, isLegacy: false };
  }
  const legacy = LEGACY_FAMILY_LIMITS[plan] ?? getPlanPricing(plan).includedMembers;
  return { limit: legacy, paid: null, isLegacy: true };
}