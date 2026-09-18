import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendAnalysisAlertEmail, formatRiskLabel } from "../../shared/scamAlertEmail.ts";

// Triggered by the "Scam Alert Email" workflow whenever a ScamAnalysis record
// is created with risk_level === "high". Emails the user who ran the scan so
// they don't have to keep checking the app. Service-role call (no user token);
// if a user token IS present, require admin so arbitrary users can't fire it.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch { /* service-role / workflow */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { analysis_id } = body;
    if (!analysis_id) {
      return Response.json({ error: 'analysis_id is required' }, { status: 400 });
    }

    let analysis;
    try {
      analysis = await base44.asServiceRole.entities.ScamAnalysis.get(analysis_id);
    } catch {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }
    if (!analysis) {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Only email on high-risk detections.
    if (analysis.risk_level !== 'high') {
      return Response.json({ skipped: true, reason: 'Not high risk' });
    }

    const userId = analysis.created_by_id;
    if (!userId) {
      return Response.json({ skipped: true, reason: 'No user on record' });
    }

    let recipient: any;
    try {
      recipient = await base44.asServiceRole.entities.User.get(userId);
    } catch {
      return Response.json({ skipped: true, reason: 'User not found' });
    }
    if (!recipient || !recipient.email) {
      return Response.json({ skipped: true, reason: 'No email on file' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const typeLabel = (analysis.message_type || 'message').replace(/_/g, ' ');
    const sent = await sendAnalysisAlertEmail({
      accessToken,
      recipientName: recipient.full_name || '',
      recipientEmail: recipient.email,
      analysis,
      subject: `Vardin Alert: High-risk ${typeLabel} detected`,
      introLine: `Vardin just flagged a message you checked as ${formatRiskLabel(analysis)} risk.`,
      reviewLink: 'https://vardin.base44.app/trust-history',
    });

    if (!sent) {
      return Response.json({ error: 'Gmail send failed' }, { status: 500 });
    }

    return Response.json({ success: true, sent_to: recipient.email });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});