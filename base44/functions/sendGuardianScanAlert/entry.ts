import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildReturnUrl } from '../../shared/appUrl.ts';

const FINANCIAL_TYPES = ["bank_government", "marketplace", "crypto_investment", "lottery_prize", "job_offer"];

// Server-side guardian alert: derives the recipient from the verified family
// relationship (created_by_id === guardian_id, consent_given) and builds the
// body from the server-fetched ScamAnalysis record — never from client-
// supplied entity fields. This prevents phishing/content-spoofing via
// attacker-controlled alert content.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const analysisId = (body?.analysis_id || '').toString();
    if (!analysisId) return Response.json({ error: 'analysis_id is required' }, { status: 400 });

    // Fetch the analysis record server-side and verify ownership.
    const analysis = await base44.asServiceRole.entities.ScamAnalysis.get(analysisId);
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });
    if (analysis.created_by_id !== user.id) {
      return Response.json({ error: 'Not authorized to alert on this analysis' }, { status: 403 });
    }

    // Fetch the ProtectedSenior link server-side, verifying the guardian
    // created it (created_by_id === guardian_id) and consent was given.
    const links = await base44.asServiceRole.entities.ProtectedSenior.filter({
      senior_user_id: user.id,
      consent_given: true,
    });
    const link = (links as any[]).find((m) => m.created_by_id === m.guardian_id);
    if (!link || !link.guardian_email) {
      return Response.json({ sent: false, message: 'No verified guardian link' });
    }

    // Check alert preference server-side.
    const pref = link.alert_preference || 'all';
    const riskLevel = analysis.risk_level || 'unknown';
    if (pref === 'high_risk_only' && riskLevel !== 'high') {
      return Response.json({ sent: false, message: 'Alert preference not met' });
    }
    if (pref === 'financial_only' && !(FINANCIAL_TYPES.includes(analysis.message_type) || riskLevel === 'high')) {
      return Response.json({ sent: false, message: 'Alert preference not met' });
    }

    // Build the email body from server-verified data only.
    const riskLabel = riskLevel.toUpperCase();
    const alertsUrl = buildReturnUrl(req.headers.get('origin'), '/alerts');
    await base44.integrations.Core.SendEmail({
      to: link.guardian_email,
      subject: `Vardin Alert: ${link.name} checked a ${riskLabel} risk message`,
      body: `Hi ${link.guardian_name || "there"},\n\n${link.name} just checked a suspicious message on Vardin.\n\nRisk level: ${riskLabel} (${analysis.risk_score || 0}/100)\nType: ${analysis.message_type || "other"}\n\nSummary: ${analysis.explanation || ""}\n\nView full details in your Guardian Alerts: ${alertsUrl}\n\nStay safe,\nThe Vardin Team`,
    });

    return Response.json({ sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}