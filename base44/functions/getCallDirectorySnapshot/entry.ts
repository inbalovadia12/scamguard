import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isCallerIdEntitled, getConfig } from '../../shared/phoneReputation.ts';

// GET /api/v1/call-directory/snapshot
// Returns the full set of phone numbers Vardin currently recommends identifying,
// for the iOS Call Directory Extension's initial load. Cursor-paginated by
// normalized_number (use `after` from the previous page). Requires Vardin auth
// and a caller-ID entitled plan (Plus / Premium).

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
    const limit = Math.min(Math.max(parseInt(body.limit || '5000', 10) || 5000, 1), 5000);
    const after = body.after ? String(body.after) : null;

    const query: any = { in_call_directory: true };
    if (after) query.normalized_number = { $gt: after };

    const rows = await base44.asServiceRole.entities.PhoneReputation.filter(query, 'normalized_number', limit);
    const latest = await base44.asServiceRole.entities.CallDirectoryDataset.list('-version', 1);

    const entries = (rows || [])
      .map((r: any) => ({ phone_number: r.normalized_number, label: r.caller_id_label || '' }))
      .filter((e: any) => e.label);

    const hasMore = rows.length === limit;
    return Response.json({
      version: latest[0]?.version || 0,
      generated_at: latest[0]?.generated_at || null,
      entries,
      has_more: hasMore,
      next_after: hasMore ? rows[rows.length - 1]?.normalized_number : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}