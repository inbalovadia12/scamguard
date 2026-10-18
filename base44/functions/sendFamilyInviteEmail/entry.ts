import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Sends a family invitation email. Moves the SendEmail integration behind an
// authenticated backend function so it cannot be called outside the app's
// intended onboarding flow.

// Rate limiting: 20 invite emails per user per hour.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    if (!checkRateLimit(user.id)) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const to = String(body.to || '').trim();
    const inviterName = String(body.inviter_name || user.full_name || 'Someone');

    if (!to) return Response.json({ error: 'Recipient email is required' }, { status: 400 });

    const subject = `${inviterName} invited you to join Vardin`;
    const emailBody = `Hi,\n\n${inviterName} has invited you to join their Vardin family protection circle. Vardin is an AI-powered scam detection tool that helps you know what's real before you click.\n\nTo accept this invitation and start protecting each other from scams, create your free Vardin account at https://vardin.base44.app/register\n\nStay safe,\nThe Vardin Team`;

    await base44.integrations.Core.SendEmail({ to, subject, body: emailBody });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});