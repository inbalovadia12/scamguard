import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { computeConfidence, computeLabel, getConfig, statusFromReputation } from '../../shared/phoneReputation.ts';

function canonicalScore(rep: any, status: string): number {
  const current = Number(rep.reputation_score);
  const score = Number.isFinite(current) ? Math.max(0, Math.min(100, current)) : 0;
  const scam = Number(rep.scam_report_count) || 0;
  const spam = Number(rep.spam_report_count) || 0;
  const suspicious = Number(rep.suspicious_report_count) || 0;
  const safe = Number(rep.safe_report_count) || 0;

  if (status === 'SCAM') return Math.max(75, score);
  if (status === 'SUSPICIOUS') return Math.max(41, Math.min(70, score || 41));
  if (status === 'SPAM') return Math.max(50, Math.min(60, score || 50));
  if (status === 'SAFE') return Math.min(score || 10, 30);
  if (scam || spam || suspicious || safe || rep.verified_business) return score;
  return 0;
}

function riskForScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 71) return 'high';
  if (score >= 41) return 'medium';
  return 'low';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const config = await getConfig(base44);
    const rows = await base44.asServiceRole.entities.PhoneReputation.list('-last_updated_at', 500);
    let scanned = 0;
    let repaired = 0;

    for (const rep of rows || []) {
      scanned += 1;
      const scam = Number(rep.scam_report_count) || 0;
      const spam = Number(rep.spam_report_count) || 0;
      const suspicious = Number(rep.suspicious_report_count) || 0;
      const safe = Number(rep.safe_report_count) || 0;
      const reportCount = scam + spam + suspicious + safe;
      const status = statusFromReputation(rep);
      const score = canonicalScore(rep, status);
      const risk = riskForScore(score);
      const confidence = computeConfidence({
        ...rep,
        scam_report_count: scam,
        spam_report_count: spam,
        suspicious_report_count: suspicious,
        safe_report_count: safe,
        reputation_score: score,
      });
      const label = computeLabel(status, config);

      const patch: any = {};
      if (rep.caller_id_status !== status) patch.caller_id_status = status;
      if (Number(rep.reputation_score) !== score) patch.reputation_score = score;
      if (rep.risk_level !== risk) patch.risk_level = risk;
      if (Number(rep.confidence_score) !== confidence) patch.confidence_score = confidence;
      if (Number(rep.report_count) !== reportCount) patch.report_count = reportCount;
      if (rep.caller_id_label !== label) patch.caller_id_label = label;

      if (Object.keys(patch).length > 0) {
        patch.last_updated_at = new Date().toISOString();
        await base44.asServiceRole.entities.PhoneReputation.update(rep.id, patch);
        repaired += 1;
      }
    }

    return Response.json({
      success: true,
      scanned,
      repaired,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('auditPhoneReputation error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Phone reputation audit failed' }, { status: 500 });
  }
});
