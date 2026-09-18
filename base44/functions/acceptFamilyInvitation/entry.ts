import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizePlan, planDisplayName } from '../../shared/familyPricing.ts';

const PLAN_RANK: Record<string, number> = { starter: 0, plus: 1, premium: 2 };

// Called when an invited user explicitly accepts a family invitation. Marks
// consent on their membership(s) and upgrades their plan to the guardian's
// plan (only ever upgrades, never downgrades). The plan field is admin-only,
// so it must go through the service role.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recordId = (body?.record_id || '').toString();

    const memberships = await base44.asServiceRole.entities.ProtectedSenior.filter({ senior_user_id: user.id });
    const pending = (memberships || []).filter((m: any) => !m.consent_given);
    if (pending.length === 0) {
      return Response.json({ accepted: false, message: 'No pending invitations' });
    }

    const toAccept = recordId ? pending.filter((m: any) => m.id === recordId) : pending;
    if (toAccept.length === 0) {
      return Response.json({ error: 'Invitation not found' }, { status: 404 });
    }

    for (const m of toAccept) {
      await base44.asServiceRole.entities.ProtectedSenior.update(m.id, { consent_given: true });
    }

    const currentPlan = normalizePlan(user.subscription_plan);
    let bestPlan = currentPlan;
    for (const m of toAccept) {
      const gp = normalizePlan(m.guardian_plan);
      if ((PLAN_RANK[gp] || 0) > (PLAN_RANK[bestPlan] || 0)) bestPlan = gp;
    }
    if (bestPlan !== currentPlan) {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { subscription_plan: bestPlan });
      } catch (_e) {
        // Plan upgrade is best-effort; consent still succeeded.
      }
    }

    return Response.json({
      accepted: true,
      count: toAccept.length,
      upgraded_to: bestPlan !== currentPlan ? bestPlan : null,
      plan_name: planDisplayName(bestPlan),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}