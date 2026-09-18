import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizePlan } from '../../shared/familyPricing.ts';

// Admin-only: sets a user's subscription plan and the number of family members
// they are eligible to add (overrides the plan default). Both are enforced
// server-side; the add-family-member function reads family_members_paid to gate
// additions.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || admin.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const userId = (body?.user_id || '').toString();
    const plan = normalizePlan(body?.plan);
    const eligibleMembers = body?.eligible_members;

    if (!userId) return Response.json({ error: 'user_id is required' }, { status: 400 });
    if (!['starter', 'plus', 'premium'].includes(plan)) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const update: any = { subscription_plan: plan };

    if (eligibleMembers != null && eligibleMembers !== '') {
      const n = Number(eligibleMembers);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        return Response.json({ error: 'Eligible members must be a positive whole number' }, { status: 400 });
      }
      update.family_members_paid = n;
    }

    await base44.asServiceRole.entities.User.update(userId, update);

    return Response.json({ success: true, user_id: userId, plan, family_members_paid: update.family_members_paid ?? null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}