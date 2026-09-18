import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Called when a guardian removes a protected member from their family. Uses the
// service role because the guardian's user token cannot delete the record
// (delete RLS is admin-only) or downgrade the senior's inherited plan.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recordId = (body?.record_id || '').toString();
    if (!recordId) return Response.json({ error: 'record_id is required' }, { status: 400 });

    let senior: any;
    try {
      senior = await base44.asServiceRole.entities.ProtectedSenior.get(recordId);
    } catch {
      return Response.json({ error: 'Membership not found' }, { status: 404 });
    }

    if (senior.guardian_id !== user.id) {
      return Response.json({ error: 'Only the guardian can remove this member' }, { status: 403 });
    }

    // Downgrade the senior's inherited plan back to starter so they no longer
    // keep premium access once removed from the family.
    if (senior.senior_user_id && senior.guardian_plan && senior.guardian_plan !== 'starter') {
      try {
        const seniorUser = await base44.asServiceRole.entities.User.get(senior.senior_user_id);
        if ((seniorUser?.subscription_plan) === senior.guardian_plan) {
          await base44.asServiceRole.entities.User.update(senior.senior_user_id, {
            subscription_plan: 'starter',
            subscription_status: 'inactive',
          });
        }
      } catch {}
    }

    // Clean up the chat thread + messages so no orphaned conversation remains.
    try {
      const threads = await base44.asServiceRole.entities.FamilyChat.filter({ member_id: senior.id });
      for (const t of threads) {
        try { await base44.asServiceRole.entities.FamilyChatMessage.deleteMany({ thread_id: t.id }); } catch {}
        try { await base44.asServiceRole.entities.FamilyChat.delete(t.id); } catch {}
      }
    } catch {}

    await base44.asServiceRole.entities.ProtectedSenior.delete(senior.id);

    return Response.json({ removed: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}