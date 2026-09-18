import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildReturnUrl } from '../../shared/appUrl.ts';
import { normalizePlan, resolveFamilyLimitBackend, planDisplayName } from '../../shared/familyPricing.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = (body?.name || '').toString().trim();
    const email = (body?.email || '').toString().trim().toLowerCase();
    const alertPref = (body?.alert_preference || 'all').toString();

    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: 'A valid email is required to add a family member' }, { status: 400 });
    }
    if (!['all', 'high_risk_only', 'financial_only'].includes(alertPref)) {
      return Response.json({ error: 'Invalid alert preference' }, { status: 400 });
    }

    const plan = normalizePlan(user.subscription_plan);

    // Enforce the family-member limit (admin-set or plan default). Server-
    // authoritative so a spoofed client cannot exceed it.
    const limit = resolveFamilyLimitBackend(plan, user);
    const existing = await base44.entities.ProtectedSenior.filter({ guardian_id: user.id });
    if (existing.length >= limit) {
      return Response.json({
        error: `You've reached your family member limit (${limit === Infinity ? '∞' : limit}). ${limit === Infinity ? '' : 'Upgrade or ask an admin to increase your eligible members.'}`,
        upgrade_url: '/pricing',
        limit,
      }, { status: 402 });
    }

    // Create the protected senior record (unlinked until they join).
    const senior = await base44.entities.ProtectedSenior.create({
      name,
      email,
      guardian_id: user.id,
      guardian_email: user.email,
      guardian_name: user.full_name,
      guardian_plan: plan,
      consent_given: false,
      alert_preference: alertPref,
    });

    // Send the invitation email with a real link to join Vardin. The platform
    // invite creates the user account flow; the email gives them the direct
    // register link so they actually end up inside the app.
    const registerUrl = buildReturnUrl(req.headers.get('origin'), '/register');
    try {
      await base44.users.inviteUser(email, 'user');
    } catch (_inviteErr) {
      // Already invited or transient error — the email below still goes out.
    }
    let emailSent = false;
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `${user.full_name || 'Your family member'} added you to their Vardin family`,
        body: [
          `Hi ${name},`,
          ``,
          `${user.full_name || 'Your family member'} has added you to their Vardin family protection circle.`,
          ``,
          `Vardin is an AI scam-detection tool that helps you and your family know what's real before you click, call, or pay.`,
          ``,
          `You now share ${user.full_name || 'their'} ${planDisplayName(plan)} plan benefits — every scan feature, at no extra cost to you.`,
          ``,
          `To get started, create your free Vardin account here:`,
          registerUrl,
          ``,
          `Once you're in, you'll see ${user.full_name || 'your family member'} listed as your guardian. Tap "Accept" to activate your protection and share the ${planDisplayName(plan)} plan benefits.`,
          ``,
          `Stay safe,`,
          `The Vardin Team`,
        ].join('\n'),
      });
      emailSent = true;
    } catch (_emailErr) {
      // Email failure must not fail the whole add.
    }

    return Response.json({
      success: true,
      senior,
      email_sent: emailSent,
      limit,
      remaining: Math.max(0, (limit === Infinity ? Infinity : limit) - (existing.length + 1)),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}