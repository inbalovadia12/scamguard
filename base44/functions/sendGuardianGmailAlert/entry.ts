import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendAnalysisAlertEmail, formatRiskLabel } from "../../shared/scamAlertEmail.ts";

const FINANCIAL_TYPES = ["bank_government", "marketplace", "crypto_investment", "lottery_prize", "job_offer"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This function is triggered by the GuardianGmailAlert workflow (service
    // role, no user token) and must not be callable by arbitrary app users.
    // If a user token IS present, require admin; allow anonymous service-role
    // calls so the workflow can still fire.
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

    // Fetch the ScamAnalysis record
    let analysis;
    try {
      analysis = await base44.asServiceRole.entities.ScamAnalysis.get(analysis_id);
    } catch {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }
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

    // Get Gmail access token (SHARED connection) and send via shared helper.
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const riskLabel = formatRiskLabel(analysis);

    const sent = await sendAnalysisAlertEmail({
      accessToken,
      recipientName: senior.guardian_name || '',
      recipientEmail: senior.guardian_email,
      analysis,
      subject: `Vardin Alert: ${senior.name} checked a ${riskLabel} risk message`,
      introLine: `${senior.name} just checked a suspicious message on Vardin that was flagged as ${riskLabel} risk.`,
      reviewLink: 'https://vardin.base44.app/alerts',
    });
    if (!sent) {
      return Response.json({ error: 'Gmail send failed' }, { status: 500 });
    }

    // Mark as reviewed to prevent duplicate alerts
    await base44.asServiceRole.entities.ScamAnalysis.update(analysis_id, { guardian_status: 'reviewed' });

    return Response.json({ success: true, sent_to: senior.guardian_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});