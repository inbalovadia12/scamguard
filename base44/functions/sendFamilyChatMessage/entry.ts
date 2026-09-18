import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGmailSenderEmail, sendGmail, buildMimeMessage } from "../../shared/gmailMime.ts";

const DEFAULT_WARNING = "⚠️ Your guardian reviewed this and warns it's a scam — please do not engage or share any information.";
const DEFAULT_ASSURANCE = "✅ Your guardian reviewed this and says it looks safe. No action needed.";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { thread_id, member_id, text, kind = 'message', alert_id, image_url } = body;

    // Resolve the ProtectedSenior record + any existing thread
    let senior;
    let thread;
    if (thread_id) {
      try {
        thread = await base44.asServiceRole.entities.FamilyChat.get(thread_id);
      } catch {
        return Response.json({ error: 'Thread not found' }, { status: 404 });
      }
      try {
        senior = await base44.asServiceRole.entities.ProtectedSenior.get(thread.member_id);
      } catch {}
    } else if (member_id) {
      try {
        senior = await base44.asServiceRole.entities.ProtectedSenior.get(member_id);
      } catch {}
      if (senior) {
        const existing = await base44.asServiceRole.entities.FamilyChat.filter({ member_id });
        thread = existing[0];
      }
    } else {
      return Response.json({ error: 'thread_id or member_id is required' }, { status: 400 });
    }

    if (!senior) return Response.json({ error: 'Membership not found' }, { status: 404 });

    const isGuardian = senior.guardian_id === user.id;
    const isSenior = senior.senior_user_id === user.id;
    if (!isGuardian && !isSenior) {
      return Response.json({ error: 'You are not part of this family chat' }, { status: 403 });
    }
    const sender = isGuardian ? 'guardian' : 'senior';

    // Build the message text
    const imageUrl = image_url ? String(image_url).slice(0, 2000) : '';
    let msgText = (text || '').trim();
    if (kind === 'warning' && !msgText) msgText = DEFAULT_WARNING;
    if (kind === 'assurance' && !msgText) msgText = DEFAULT_ASSURANCE;
    if (!msgText && !imageUrl) return Response.json({ error: 'text or image_url is required' }, { status: 400 });
    msgText = msgText.slice(0, 2000);
    const previewText = msgText || '📷 Photo';

    // Create the thread if it doesn't exist yet
    if (!thread) {
      thread = await base44.entities.FamilyChat.create({
        member_id: senior.id,
        guardian_id: senior.guardian_id,
        senior_user_id: senior.senior_user_id,
        last_message: '',
        last_message_at: new Date().toISOString(),
        last_sender: sender,
        unread_by_guardian: 0,
        unread_by_senior: 0,
      });
    }

    // Create the message as the sender
    const message = await base44.entities.FamilyChatMessage.create({
      thread_id: thread.id,
      guardian_id: senior.guardian_id,
      senior_user_id: senior.senior_user_id,
      sender,
      sender_id: user.id,
      text: msgText,
      kind,
      image_url: imageUrl || undefined,
      alert_id: alert_id || undefined,
    });

    // Update the thread preview + unread count for the other party
    const unreadField = sender === 'guardian' ? 'unread_by_senior' : 'unread_by_guardian';
    await base44.entities.FamilyChat.update(thread.id, {
      last_message: previewText.slice(0, 500),
      last_message_at: new Date().toISOString(),
      last_sender: sender,
      [unreadField]: (thread[unreadField] || 0) + 1,
    });

    // Resolve the originating alert when the guardian warns / assures
    if (alert_id && (kind === 'warning' || kind === 'assurance')) {
      try {
        await base44.entities.FamilyAlert.update(alert_id, {
          guardian_action: kind === 'warning' ? 'confirm_scam' : 'mark_safe',
          guardian_note: msgText,
          status: 'resolved',
        });
      } catch {}
    }

    // Best-effort email to the other party so they know there's a message
    try {
      const recipientEmail = sender === 'guardian' ? senior.email : senior.guardian_email;
      const recipientName = sender === 'guardian' ? senior.name : senior.guardian_name;
      const fromName = sender === 'guardian' ? (senior.guardian_name || 'Your Guardian') : (senior.name || 'Your Family Member');
      if (recipientEmail) {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
        const senderEmail = await getGmailSenderEmail(accessToken);
        const subject = `Vardin family message from ${fromName}`;
        const bodyText = [
          `Hi ${recipientName || 'there'},`,
          ``,
          `${fromName} sent you a message in Vardin:`,
          ``,
          previewText,
          ``,
          `Reply in Vardin:`,
          `https://vardin.base44.app/family`,
          ``,
          `Stay safe,`,
          `The Vardin Team`,
        ].join('\n');
        const mime = buildMimeMessage(senderEmail, 'Vardin', recipientEmail, subject, bodyText);
        await sendGmail(accessToken, mime);
      }
    } catch {}

    return Response.json({ success: true, thread_id: thread.id, message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}