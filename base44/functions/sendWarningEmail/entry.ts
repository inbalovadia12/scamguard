import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Sends a scam warning email from a guardian to a family member. The recipient
// MUST be a verified family member (ProtectedSenior record where the sender is
// the guardian, or the sender is the senior and the recipient is the guardian).
// Subject and body are accepted from the caller but length-capped; the recipient
// whitelist check prevents sending to arbitrary users.

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
    const to = String(body.to || '').trim().toLowerCase();
    const subject = String(body.subject || '').slice(0, 200);
    const emailBody = String(body.body || '').slice(0, 5000);

    if (!to || !subject || !emailBody) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the recipient is a family member of the sender.
    // The sender must be the guardian of a ProtectedSenior whose email matches `to`,
    // OR the sender must be the senior and the guardian's email matches `to`.
    let authorized = false;
    try {
      const asGuardian = await base44.entities.ProtectedSenior.filter({
        guardian_id: user.id,
      });
      for (const m of asGuardian) {
        if (m.email && m.email.toLowerCase() === to) { authorized = true; break; }
      }
      if (!authorized) {
        const asSenior = await base44.entities.ProtectedSenior.filter({
          senior_user_id: user.id,
        });
        for (const m of asSenior) {
          if (m.guardian_email && m.guardian_email.toLowerCase() === to) { authorized = true; break; }
        }
      }
    } catch {}

    if (!authorized) {
      return Response.json({ error: 'Recipient is not a family member' }, { status: 403 });
    }

    await base44.integrations.Core.SendEmail({ to, subject, body: emailBody });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});