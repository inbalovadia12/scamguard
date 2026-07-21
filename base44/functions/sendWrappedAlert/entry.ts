import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getGmailSenderEmail, sendGmailEmail } from '../../shared/gmailHelpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.list();
    const admins = (users || []).filter((u: any) => u.role === 'admin' && u.email);

    if (admins.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No admin users found' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const senderEmail = await getGmailSenderEmail(accessToken);

    const bodyText = [
      `Hi there,`,
      ``,
      `Your 2026 Vardin Wrapped is now available!`,
      ``,
      `See your year in scam protection:`,
      `• Total scans you ran`,
      `• Scams we blocked for you`,
      `• Your top threat type`,
      `• Days you stayed protected`,
      `• And more!`,
      ``,
      `View your Wrapped:`,
      `https://app.vardin.com/wrapped`,
      ``,
      `Available for one week only — don't miss it!`,
      ``,
      `Stay safe,`,
      `The Vardin Team`,
    ].join('\n');

    let sent = 0;
    for (const admin of admins) {
      const ok = await sendGmailEmail(
        accessToken, senderEmail,
        admin.full_name || 'User', admin.email,
        'Your Vardin Wrapped is Ready!',
        bodyText
      );
      if (ok) sent++;
    }

    return Response.json({ success: true, sent, total: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});