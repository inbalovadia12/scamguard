import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizePlan, planDisplayName } from '../../shared/familyPricing.ts';

// Returns the protected-member perspective: which families the current user
// belongs to, the guardian for each, and the other members (siblings) the
// guardian manages. Service-role reads because RLS doesn't let a member read
// their siblings' records directly.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Match by linked user id (already joined) OR by email (pending invitation
    // before the post-login linkFamilyMember step runs). This ensures the
    // protected-member view appears immediately on first load, without a manual
    // refresh, and that realtime create events surface new invitations.
    const email = (user.email || '').toLowerCase();
    const [linked, invited] = await Promise.all([
      base44.asServiceRole.entities.ProtectedSenior.filter({ senior_user_id: user.id }),
      email ? base44.asServiceRole.entities.ProtectedSenior.filter({ email }) : [],
    ]);
    const seen = new Set<string>();
    const memberships: any[] = [];
    for (const m of [...(linked || []), ...(invited || [])]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.senior_user_id && m.senior_user_id !== user.id) continue;
      memberships.push(m);
    }
    if (memberships.length === 0) {
      return Response.json({ memberships: [] });
    }

    const guardianIds = Array.from(new Set(memberships.map((m: any) => m.guardian_id).filter(Boolean)));
    const siblingMap: Record<string, any[]> = {};
    await Promise.all(guardianIds.map(async (gid) => {
      siblingMap[gid] = await base44.asServiceRole.entities.ProtectedSenior.filter({ guardian_id: gid });
    }));

    const result = memberships.map((m: any) => {
      const siblings = (siblingMap[m.guardian_id] || []).map((s: any) => ({
        name: s.name,
        email: s.email,
        consent_given: !!s.consent_given,
        is_you: s.id === m.id,
      }));
      return {
        senior_record_id: m.id,
        guardian_id: m.guardian_id,
        guardian_name: m.guardian_name || 'Your family member',
        guardian_email: m.guardian_email || '',
        guardian_plan: planDisplayName(normalizePlan(m.guardian_plan)),
        consent_given: !!m.consent_given,
        alert_preference: m.alert_preference || 'all',
        siblings,
      };
    });

    return Response.json({ memberships: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}