import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizePlan, planDisplayName, resolveFamilyLimitBackend } from '../../shared/familyPricing.ts';

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

    // Match by linked user id OR by email (pending invitation before the
    // post-login linkage step runs), so acceptance works immediately even if
    // linkFamilyMember has not yet executed.
    const email = (user.email || '').toLowerCase();
    const [linked, invited] = await Promise.all([
      base44.asServiceRole.entities.ProtectedSenior.filter({ senior_user_id: user.id }),
      email ? base44.asServiceRole.entities.ProtectedSenior.filter({ email }) : [],
    ]);
    const seen = new Set<string>();
    const pending: any[] = [];
    for (const m of [...(linked || []), ...(invited || [])]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.senior_user_id && m.senior_user_id !== user.id) continue;
      // A user cannot be their own guardian — reject self-acceptance.
      if (m.guardian_id === user.id) continue;
      // Only records created by the guardian (through addFamilyMember, where
      // created_by_id === guardian_id) are valid invitations. This prevents
      // user A from creating a record with guardian_id = user B and then
      // accepting it to inherit user B's paid plan.
      if (m.created_by_id !== m.guardian_id) continue;
      if (!m.consent_given) pending.push(m);
    }
    if (pending.length === 0) {
      return Response.json({ accepted: false, message: 'No pending invitations' });
    }

    const toAccept = recordId ? pending.filter((m: any) => m.id === recordId) : pending;
    if (toAccept.length === 0) {
      return Response.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Enforce the guardian's family-member limit before accepting. Count
    // already-accepted members per guardian and reject records that would
    // exceed the limit. This prevents a paid user from creating unlimited
    // ProtectedSenior records directly via the entity API and having each
    // accepted by a different user to grant them paid-plan benefits.
    const guardianAcceptedCount = new Map<string, number>();
    const guardianLimit = new Map<string, number>();
    const accepted: any[] = [];
    const rejected: any[] = [];
    for (const m of toAccept) {
      if (!m.guardian_id) { rejected.push(m); continue; }
      let limit = guardianLimit.get(m.guardian_id);
      if (limit === undefined) {
        try {
          const guardian = await base44.asServiceRole.entities.User.get(m.guardian_id);
          const gp = normalizePlan(guardian?.subscription_plan);
          limit = resolveFamilyLimitBackend(gp, guardian);
        } catch { limit = 1; }
        guardianLimit.set(m.guardian_id, limit);
      }
      let count = guardianAcceptedCount.get(m.guardian_id);
      if (count === undefined) {
        const existing = await base44.asServiceRole.entities.ProtectedSenior.filter(
          { guardian_id: m.guardian_id, consent_given: true }
        );
        count = Array.isArray(existing) ? existing.length : 0;
      }
      if (count >= limit) { rejected.push(m); continue; }
      guardianAcceptedCount.set(m.guardian_id, count + 1);
      accepted.push(m);
    }

    if (accepted.length === 0) {
      return Response.json({
        accepted: false,
        message: 'Family member limit reached for this guardian',
        rejected_count: rejected.length,
      }, { status: 402 });
    }

    for (const m of accepted) {
      await base44.asServiceRole.entities.ProtectedSenior.update(m.id, {
        senior_user_id: user.id,
        consent_given: true,
      });
    }

    const currentPlan = normalizePlan(user.subscription_plan);
    let bestPlan = currentPlan;
    for (const m of accepted) {
      // Verify the guardian's actual plan server-side via the User record —
      // never trust the client-writable guardian_plan field on the
      // ProtectedSenior record, which any user can set to "premium".
      if (!m.guardian_id) continue;
      try {
        const guardian = await base44.asServiceRole.entities.User.get(m.guardian_id);
        const gp = normalizePlan(guardian?.subscription_plan);
        if ((PLAN_RANK[gp] || 0) > (PLAN_RANK[bestPlan] || 0)) bestPlan = gp;
      } catch {}
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
      count: accepted.length,
      rejected_count: rejected.length,
      upgraded_to: bestPlan !== currentPlan ? bestPlan : null,
      plan_name: planDisplayName(bestPlan),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}