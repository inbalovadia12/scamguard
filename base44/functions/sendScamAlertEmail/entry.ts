import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendAnalysisAlertEmail, formatRiskLabel } from "../../shared/scamAlertEmail.ts";

// Triggered by the "Scam Alert Email" workflow whenever a ScamAnalysis record
// is created with risk_level === "high". Emails the user who ran the scan so
// they don't have to keep checking the app. Service-role call (no user token);
// if a user token IS present, require admin so arbitrary users can't fire it.

// Rate limiting: caps anonymous calls per IP per minute.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

// Idempotency: prevent re-sending the same alert within the TTL window.
const alertedAnalyses = new Map<string, number>();
const ALERT_TTL_MS = 60 * 60 * 1000; // 1 hour

function isRecentlyAlerted(analysisId: string): boolean {
  const ts = alertedAnalyses.get(analysisId);
  if (!ts) return false;
  if (Date.now() - ts > ALERT_TTL_MS) {
    alertedAnalyses.delete(analysisId);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch { /* service-role / workflow */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // Rate limit non-admin calls to prevent spam and ID enumeration.
    if (!user && !checkRateLimit(getClientIP(req))) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { analysis_id } = body;
    if (!analysis_id) {
      return Response.json({ error: 'analysis_id is required' }, { status: 400 });
    }

    // Idempotency: skip if this analysis was recently alerted.
    if (isRecentlyAlerted(analysis_id)) {
      return Response.json({ success: true, skipped: true });
    }

    // Generic response for all non-send cases to prevent enumeration of
    // analysis IDs, risk levels, or user existence.
    const SKIP = () => Response.json({ success: true, skipped: true });

    let analysis;
    try {
      analysis = await base44.asServiceRole.entities.ScamAnalysis.get(analysis_id);
    } catch {
      return SKIP();
    }
    if (!analysis) {
      return SKIP();
    }

    // Only email on high-risk detections.
    if (analysis.risk_level !== 'high') {
      return SKIP();
    }

    const userId = analysis.created_by_id;
    if (!userId) {
      return SKIP();
    }

    let recipient: any;
    try {
      recipient = await base44.asServiceRole.entities.User.get(userId);
    } catch {
      return SKIP();
    }
    if (!recipient || !recipient.email) {
      return SKIP();
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
      return SKIP();
    }

    // Mark as alerted to prevent re-sends within the TTL window.
    alertedAnalyses.set(analysis_id, Date.now());

    return Response.json({ success: true, sent: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});