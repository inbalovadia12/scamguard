import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { secrets } from 'base44:runtime';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const retellConfigured = Boolean(secrets.get('RETELL_API_KEY'));
    const baseStatus = {
      connected: retellConfigured,
      webhook_function: 'receiveCallGuardReport',
      webhook_endpoint: '/api/functions/receiveCallGuardReport',
    };

    // CallGuardReport is intentionally admin-only. Never bypass that security boundary
    // for ordinary users by returning aggregate data from the service-role client.
    if (user.role !== 'admin') {
      return Response.json(baseStatus);
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

    return Response.json({
      ...baseStatus,
      total_reports: total,
      processed_reports: processed,
      pending_reports: total - processed,
      verdict_counts: verdictCounts,
      last_activity_at: lastProcessedAt,
    });
  } catch (error) {
    console.error('Call Guard dashboard error', error);
    return Response.json({ error: error.message || 'Failed to load Call Guard status' }, { status: 500 });
  }
});
