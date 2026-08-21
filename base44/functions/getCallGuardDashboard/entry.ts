import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { secrets } from 'base44:runtime';

const CALL_GUARD_ADMIN_EMAIL = 'inbalto.ovadia@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const isCallGuardAdmin = user.role === 'admin' && String(user.email || '').toLowerCase() === CALL_GUARD_ADMIN_EMAIL;
    const retellConfigured = Boolean(secrets.get('RETELL_API_KEY'));
    const baseStatus = {
      connected: retellConfigured,
      webhook_function: 'receiveCallGuardReport',
      webhook_endpoint: '/api/functions/receiveCallGuardReport',
    };

    // Defense in depth: only the single designated admin account may receive Call Guard data.
    // Everyone else gets no call metadata, report data, or configuration details.
    if (!isCallGuardAdmin) {
      return Response.json({ under_construction: true });
    }

    const serviceRole = base44.asServiceRole;
    const reports = await serviceRole.entities.CallGuardReport.filter({});

    const total = reports.length;
    const processed = reports.filter((r: any) => r.processed).length;
    const verdictCounts = { safe: 0, suspicious: 0, scam: 0 };

    let lastProcessedAt: string | null = null;
    for (const report of reports as any[]) {
      const verdict = report.vardin_verdict;
      if (verdict === 'safe' || verdict === 'suspicious' || verdict === 'scam') verdictCounts[verdict]++;
      const date = report.updated_date || report.created_date;
      if (date && (!lastProcessedAt || new Date(date) > new Date(lastProcessedAt))) lastProcessedAt = date;
    }

    const sortedReports = (reports as any[])
      .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
      .map((report) => ({
        id: report.id,
        call_id: report.call_id,
        created_date: report.created_date,
        updated_date: report.updated_date,
        processed: Boolean(report.processed),
        vardin_verdict: report.vardin_verdict || null,
        vardin_confidence_score: report.vardin_confidence_score ?? null,
        vardin_explanation: report.vardin_explanation || '',
        vardin_tactics_detected: report.vardin_tactics_detected || [],
        vardin_recommended_actions: report.vardin_recommended_actions || [],
        call_summary: report.call_summary || '',
        transcript: report.transcript || '',
        call_analysis_data: report.call_analysis_data || '',
      }));

    return Response.json({
      ...baseStatus,
      total_reports: total,
      processed_reports: processed,
      pending_reports: total - processed,
      verdict_counts: verdictCounts,
      last_activity_at: lastProcessedAt,
      reports: sortedReports,
    });
  } catch (error) {
    console.error('Call Guard dashboard error', error);
    return Response.json({ error: error.message || 'Failed to load Call Guard status' }, { status: 500 });
  }
});
