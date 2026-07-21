import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getGmailSenderEmail, sendGmailEmail } from '../../shared/gmailHelpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const seniors = await base44.asServiceRole.entities.ProtectedSenior.list();
    if (!seniors || seniors.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No protected seniors found' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const senderEmail = await getGmailSenderEmail(accessToken);

    let sent = 0;
    let skipped = 0;

    for (const senior of seniors) {
      if (!senior.email) { skipped++; continue; }

      const analyses = await base44.asServiceRole.entities.ScamAnalysis.filter({
        senior_id: senior.id,
        submitted_by_senior: true,
      });

      const yesterday = Date.now() - 86400000;
      const recent = (analyses || []).filter(
        (a: any) => a.created_date && new Date(a.created_date).getTime() >= yesterday
      );

      const highRisk = recent.filter((a: any) => a.risk_level === 'high');
      const mediumRisk = recent.filter((a: any) => a.risk_level === 'medium');
      const lowRisk = recent.filter((a: any) => a.risk_level === 'low');

      const lines: string[] = [
        `Hi ${senior.name},`,
        ``,
        `Here's your daily scam protection summary.`,
        ``,
      ];

      if (recent.length === 0) {
        lines.push(`✅ No suspicious messages were detected in the last 24 hours.`);
        lines.push(``);
        lines.push(`You're all clear! Remember:`);
        lines.push(`• Don't click links from unknown senders`);
        lines.push(`• Never share personal info via text or email`);
        lines.push(`• When in doubt, use Vardin to check`);
      } else {
        lines.push(`📊 Today's Activity:`);
        lines.push(`• ${recent.length} message${recent.length !== 1 ? 's' : ''} checked`);
        lines.push(`• ${highRisk.length} high risk`);
        lines.push(`• ${mediumRisk.length} medium risk`);
        lines.push(`• ${lowRisk.length} low risk`);
        lines.push(``);

        if (highRisk.length > 0) {
          lines.push(`⚠️ High Risk Alerts:`);
          for (const a of highRisk) {
            lines.push(`  • ${a.message_type || 'Unknown'} - Score: ${a.risk_score}/100`);
          }
          lines.push(``);
        }

        lines.push(`Remember: If something feels suspicious, don't respond and ask for help.`);
      }

      lines.push(``, `Stay safe,`, `The Vardin Team`);
      const bodyText = lines.join('\n');

      const ok = await sendGmailEmail(
        accessToken, senderEmail,
        senior.name, senior.email,
        'Your Daily Vardin Protection Summary',
        bodyText
      );
      if (ok) sent++; else skipped++;
    }

    return Response.json({ success: true, sent, skipped, total: seniors.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});