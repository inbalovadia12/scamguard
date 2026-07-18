import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const FINANCIAL_TYPES = ["bank_government", "marketplace", "crypto_investment", "lottery_prize", "job_offer"];

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return '=?UTF-8?B?' + btoa(binary) + '?=';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { analysis_id } = body;

    if (!analysis_id) {
      return Response.json({ error: 'analysis_id is required' }, { status: 400 });
    }

    // Fetch the ScamAnalysis record
    const analysis = await base44.asServiceRole.entities.ScamAnalysis.get(analysis_id);
    if (!analysis) {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Only process high-risk analyses submitted by seniors
    if (analysis.risk_level !== 'high' || !analysis.submitted_by_senior || !analysis.senior_id) {
      return Response.json({ skipped: true, reason: 'Not a high-risk senior analysis' });
    }

    // Skip if already notified
    if (analysis.guardian_status === 'reviewed' || analysis.guardian_status === 'handled') {
      return Response.json({ skipped: true, reason: 'Already notified' });
    }

    // Fetch the ProtectedSenior record
    const senior = await base44.asServiceRole.entities.ProtectedSenior.get(analysis.senior_id);
    if (!senior || !senior.guardian_email) {
      return Response.json({ skipped: true, reason: 'No guardian email found' });
    }

    // Check alert preference
    const pref = senior.alert_preference || 'all';
    if (pref === 'financial_only' && !FINANCIAL_TYPES.includes(analysis.message_type)) {
      return Response.json({ skipped: true, reason: 'Financial-only preference not met' });
    }

    // Get Gmail access token (SHARED connection)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Get the authorized user's email for the From header
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const senderEmail = profile.emailAddress || 'me';

    // Build the email content
    const riskLabel = (analysis.risk_level || 'unknown').toUpperCase();
    const subject = `Vardin Alert: ${senior.name} checked a ${riskLabel} risk message`;
    const steps = (analysis.next_steps || []).map((s: string) => '  • ' + s).join('\n');
    const tactics = (analysis.tactics_detected || []).join(', ') || 'None detected';

    const bodyText = [
      `Hi ${senior.guardian_name || 'there'},`,
      ``,
      `${senior.name} just checked a suspicious message on Vardin that was flagged as ${riskLabel} risk.`,
      ``,
      `Risk Score: ${analysis.risk_score ?? '?'}/100`,
      `Message Type: ${analysis.message_type || 'other'}`,
      ``,
      `Summary:`,
      `${analysis.explanation || 'No summary available.'}`,
      ``,
      `Tactics Detected: ${tactics}`,
      ``,
      `Recommended Next Steps:`,
      `${steps || '  No specific steps available.'}`,
      ``,
      `View full details in your Guardian Alerts:`,
      `https://app.vardin.com/alerts`,
      ``,
      `Stay safe,`,
      `The Vardin Team`,
    ].join('\n');

    // Construct RFC 2822 message with proper encoding
    const mimeMessage = [
      `From: Vardin Alerts <${senderEmail}>`,
      `To: ${senior.guardian_name || ''} <${senior.guardian_email}>`,
      `Subject: ${encodeSubject(subject)}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `MIME-Version: 1.0`,
      ``,
      bodyText,
    ].join('\r\n');

    const raw = base64UrlEncode(mimeMessage);

    // Send via Gmail API
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return Response.json({ error: 'Gmail send failed', details: errText }, { status: 500 });
    }

    // Mark as reviewed to prevent duplicate alerts
    await base44.asServiceRole.entities.ScamAnalysis.update(analysis_id, { guardian_status: 'reviewed' });

    return Response.json({ success: true, sent_to: senior.guardian_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});