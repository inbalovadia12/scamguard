import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizePlan } from '../../shared/familyPricing.ts';

// Called when a user logs in / signs up. Links any ProtectedSenior records that
// match this user's email (and aren't yet linked) by recording their user id —
// but does NOT mark consent or upgrade the plan. The invited user must
// explicitly accept the invitation (see acceptFamilyInvitation) before they are
// monitored and inherit the guardian's plan benefits.
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

    const guardians: any[] = [];

    for (const senior of unlinked) {
      // Link the senior record to this user only. Consent + plan upgrade happen
      // when the user explicitly accepts the invitation.
      await base44.asServiceRole.entities.ProtectedSenior.update(senior.id, {
        senior_user_id: user.id,
      });

      guardians.push({
        senior_record_id: senior.id,
        guardian_name: senior.guardian_name || 'Your family member',
        guardian_email: senior.guardian_email || '',
        plan: normalizePlan(senior.guardian_plan),
      });
    }

    return Response.json({ linked: true, guardians });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}