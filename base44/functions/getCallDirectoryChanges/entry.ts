import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isCallerIdEntitled, getConfig } from '../../shared/phoneReputation.ts';

// GET /api/v1/call-directory/changes?since={version}
// Returns the ADD / UPDATE / REMOVE changes that occurred after the dataset
// version the iOS app already has. Cursor-paginated by created_date (use
// `after` from the previous page). Requires Vardin auth + entitled plan.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const config = await getConfig(base44);
    if (!isCallerIdEntitled(user, config)) {
      return Response.json({
        error: 'Caller identification requires a Vardin Plus or Premium plan',
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const since = Math.max(parseInt(body.since || '0', 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(body.limit || '5000', 10) || 5000, 1), 5000);
    const after = body.after ? String(body.after) : null;

    const query: any = { version: { $gt: since } };
    if (after) query.created_date = { $gt: after };

    const rows = await base44.asServiceRole.entities.CallDirectoryChange.filter(query, 'created_date', limit);
    const latest = await base44.asServiceRole.entities.CallDirectoryDataset.list('-version', 1);

    const changes = (rows || []).map((c: any) => ({
      phone_number: c.phone_number,
      operation: c.operation,
      label: c.label || '',
      version: c.version,
      timestamp: c.timestamp || c.created_date,
    }));

    const hasMore = rows.length === limit;
    return Response.json({
      version: latest[0]?.version || 0,
      generated_at: latest[0]?.generated_at || null,
      changes,
      has_more: hasMore,
      next_after: hasMore ? rows[rows.length - 1]?.created_date : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}