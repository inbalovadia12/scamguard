import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGmailSenderEmail, sendGmail, buildMimeMessage } from "../../shared/gmailMime.ts";

const DEFAULT_SETTINGS = {
  link_protection: true, message_protection: true, image_scanning: true,
  qr_scanning: true, email_protection: true, call_protection: true,
  ask_family: true, guardian_notifications: true, protection_level: "standard",
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { analysis_id, analysis_type, member_id, threat_excerpt, risk_level, scam_type, member_note } = body;

    if (!member_id || !analysis_type) {
      return Response.json({ error: 'member_id and analysis_type are required' }, { status: 400 });
    }

    // Verify the caller actually is the protected member of this senior record
    let senior;
    try {
      senior = await base44.asServiceRole.entities.ProtectedSenior.get(member_id);
    } catch {
      return Response.json({ error: 'This is not your family membership' }, { status: 403 });
    }
    if (!senior || senior.senior_user_id !== user.id) {
      return Response.json({ error: 'This is not your family membership' }, { status: 403 });
    }

    const settings = { ...DEFAULT_SETTINGS, ...(senior.protection_settings || {}) };
    if (!settings.ask_family) {
      return Response.json({ error: 'Ask Family is not enabled for this member' }, { status: 403 });
    }

    // Create the alert as the member (created_by_id = member)
    const alert = await base44.entities.FamilyAlert.create({
      analysis_id: analysis_id || undefined,
      analysis_type,
      member_id,
      guardian_id: senior.guardian_id,
      threat_excerpt: (threat_excerpt || '').slice(0, 500),
      risk_level: risk_level || 'medium',
      scam_type: scam_type || 'other',
      member_note: (member_note || '').slice(0, 500) || undefined,
      status: 'pending_guardian',
    });

    // Notify the guardian by email when high risk or notifications enabled
    const shouldEmail = risk_level === 'high' || settings.guardian_notifications;
    if (shouldEmail && senior.guardian_email) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
        const senderEmail = await getGmailSenderEmail(accessToken);
        const riskLabel = (risk_level || 'medium').toUpperCase();
        const subject = `Vardin Ask Family: ${senior.name || 'A family member'} needs help with a ${riskLabel} risk alert`;
        const bodyText = [
          `Hi ${senior.guardian_name || 'there'},`,
          ``,
          `${senior.name || 'Your family member'} used "Ask Family" on a scan flagged ${riskLabel} risk.`,
          ``,
          `What they checked:`,
          (threat_excerpt || '(no excerpt provided)'),
          ``,
          member_note ? `Their note: ${member_note}` : '',
          ``,
          `Review and respond in Vardin:`,
          `https://app.vardin.com/alerts`,
          ``,
          `Stay safe,`,
          `The Vardin Team`,
        ].filter(Boolean).join('\n');

        const mimeMessage = buildMimeMessage(senderEmail, senior.guardian_name || '', senior.guardian_email, subject, bodyText);
        await sendGmail(accessToken, mimeMessage);
      } catch (e) {
        // Email failure must not fail the alert creation
      }
    }

    return Response.json({ success: true, alert });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}