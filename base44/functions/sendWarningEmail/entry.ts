import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Sends a scam warning email from a guardian to a family member. Moves the
// SendEmail integration behind an authenticated backend function so it
// cannot be called outside the app's intended flow.

// Rate limiting: 10 warning emails per user per hour.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
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
    const subject = String(body.subject || '').slice(0, 200);
    const emailBody = String(body.body || '').slice(0, 5000);

    if (!to || !subject || !emailBody) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await base44.integrations.Core.SendEmail({ to, subject, body: emailBody });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});