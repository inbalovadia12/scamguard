import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Called when a protected member chooses to leave a family. Removes their
// ProtectedSenior record(s). Uses the service role because the delete RLS does
// not cover the senior (only the guardian/creator can delete via the user token).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recordId = (body?.record_id || '').toString();

    const memberships = await base44.asServiceRole.entities.ProtectedSenior.filter({ senior_user_id: user.id });
    const toRemove = recordId
      ? (memberships || []).filter((m: any) => m.id === recordId)
      : (memberships || []);
    if (toRemove.length === 0) {
      return Response.json({ left: false, message: 'You are not in any family' });
    }

    for (const m of toRemove) {
      await base44.asServiceRole.entities.ProtectedSenior.delete(m.id);
    }

    return Response.json({ left: true, count: toRemove.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}