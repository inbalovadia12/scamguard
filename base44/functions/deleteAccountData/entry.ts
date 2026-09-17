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
    await safeDelete(svc.entities.FamilyAlert, { created_by_id: userId });
    await safeDelete(svc.entities.FamilyAlert, { guardian_id: userId });
    await safeDelete(svc.entities.Referral, { referrer_id: userId });
    await safeDelete(svc.entities.Referral, { referred_user_id: userId });

    // Credit purchases the user initiated
    await safeDelete(svc.entities.CreditPurchase, { user_id: userId });
    await safeDelete(svc.entities.CreditPurchase, { created_by_id: userId });
    // Admin-granted credits to this user (audit records)
    await safeDelete(svc.entities.CreditGrant, { user_id: userId });
    // Community phone reports the user submitted
    await safeDelete(svc.entities.PhoneCommunityReport, { created_by_id: userId });

    // ProtectedSenior: delete where user is guardian or the protected senior
    await safeDelete(svc.entities.ProtectedSenior, { guardian_id: userId });
    await safeDelete(svc.entities.ProtectedSenior, { senior_user_id: userId });

    // Clear user profile data and revoke entitlements
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await base44.auth.updateMe({
        full_name: '',
        credits_used: 0,
        credits_reset_month: currentMonth,
        admin_credit_balance: 0,
        referral_bonus_credits: 0,
        subscription_plan: 'starter',
        subscription_status: 'cancelled',
        alert_preference: 'all',
        notify_email: false,
        privacy_auto_redact: true,
      });
    } catch (e) { /* best effort */ }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}