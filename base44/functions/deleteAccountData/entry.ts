import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;
    const svc = base44.asServiceRole;

    const safeDelete = async (entity, query) => {
      try { await entity.deleteMany(query); } catch (e) { /* entity may not exist or no records */ }
    };

    // Delete all user-owned entity records (service role bypasses RLS)
    await safeDelete(svc.entities.ScamAnalysis, { created_by_id: userId });
    await safeDelete(svc.entities.ImageScan, { created_by_id: userId });
    await safeDelete(svc.entities.PhoneLookup, { created_by_id: userId });
    await safeDelete(svc.entities.LiveGuardSession, { created_by_id: userId });
    await safeDelete(svc.entities.ConversationAnalysis, { created_by_id: userId });
    await safeDelete(svc.entities.LessonProgress, { created_by_id: userId });
    await safeDelete(svc.entities.Feedback, { created_by_id: userId });
    await safeDelete(svc.entities.CommunityStory, { created_by_id: userId });
    await safeDelete(svc.entities.StoryLike, { created_by_id: userId });
    await safeDelete(svc.entities.LocalScamScan, { created_by_id: userId });
    await safeDelete(svc.entities.ScamReport, { created_by_id: userId });

    // ProtectedSenior: delete where user is guardian or the protected senior
    await safeDelete(svc.entities.ProtectedSenior, { guardian_id: userId });
    await safeDelete(svc.entities.ProtectedSenior, { senior_user_id: userId });

    // Clear user profile data
    try {
      await base44.auth.updateMe({
        full_name: '',
        credits_used: 0,
        alert_preference: 'all',
        notify_email: true,
        privacy_auto_redact: true,
      });
    } catch (e) { /* best effort */ }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}