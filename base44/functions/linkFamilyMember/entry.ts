import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizePlan, planDisplayName } from '../../shared/familyPricing.ts';

const PLAN_RANK: Record<string, number> = { starter: 0, plus: 1, premium: 2 };

// Called when a user logs in / signs up. Links any ProtectedSenior records that
// match this user's email (and aren't yet linked), marks consent, and upgrades
// the user's plan to inherit the guardian's plan benefits (only ever upgrades,
// never downgrades). Returns the guardians so the UI can show a notification.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = (user.email || '').toLowerCase();
    if (!email) return Response.json({ linked: false, guardians: [] });

    // Service-role read so we find records by email even before linking.
    const candidates = await base44.asServiceRole.entities.ProtectedSenior.filter({ email });
    const unlinked = candidates.filter((s: any) => !s.senior_user_id);

    if (unlinked.length === 0) {
      return Response.json({ linked: false, guardians: [] });
    }

    const currentPlan = normalizePlan(user.subscription_plan);
    let upgradedPlan = currentPlan;
    const guardians: any[] = [];

    for (const senior of unlinked) {
      // Link the senior record to this user and mark consent as accepted (by
      // creating their account after the invite, they consent to protection).
      await base44.asServiceRole.entities.ProtectedSenior.update(senior.id, {
        senior_user_id: user.id,
        consent_given: true,
      });

      const guardianPlan = normalizePlan(senior.guardian_plan);
      if ((PLAN_RANK[guardianPlan] || 0) > (PLAN_RANK[upgradedPlan] || 0)) {
        upgradedPlan = guardianPlan;
      }

      guardians.push({
        senior_record_id: senior.id,
        guardian_name: senior.guardian_name || 'Your family member',
        guardian_email: senior.guardian_email || '',
        plan: guardianPlan,
      });
    }

    // Upgrade the user's plan to the best guardian plan found (admin-only field,
    // so it must go through the service role). Only upgrades, never downgrades.
    if (upgradedPlan !== currentPlan) {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { subscription_plan: upgradedPlan });
      } catch (_e) {
        // Plan upgrade is best-effort; linking still succeeded.
      }
    }

    return Response.json({
      linked: true,
      guardians,
      upgraded_to: upgradedPlan !== currentPlan ? upgradedPlan : null,
      plan_name: planDisplayName(upgradedPlan),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}