import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ADMIN ONLY. Returns Call Directory dataset status for the admin dashboard:
// current version, entry count, last sync, last snapshot, errors, and recent
// added / updated / removed activity.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const datasets = await base44.asServiceRole.entities.CallDirectoryDataset.list('-version', 10);
    const latest = datasets[0] || null;

    // count currently-published entries (batched)
    let entryCount = 0;
    let after: string | null = null;
    while (true) {
      const query: any = { in_call_directory: true };
      if (after) query.normalized_number = { $gt: after };
      const batch = await base44.asServiceRole.entities.PhoneReputation.filter(query, 'normalized_number', 500);
      const n = batch ? batch.length : 0;
      entryCount += n;
      if (!n || n < 500) break;
      after = batch[batch.length - 1]?.normalized_number;
      if (entryCount > 100000) break; // safety
    }

    const errors = datasets.filter((d: any) => d.status === 'error');
    const recentChanges = await base44.asServiceRole.entities.CallDirectoryChange.list('-created_date', 50);

    return Response.json({
      latest_version: latest?.version || 0,
      latest_generated_at: latest?.generated_at || null,
      latest_triggered_by: latest?.triggered_by || null,
      latest_notes: latest?.notes || null,
      entry_count: entryCount,
      last_added_count: latest?.added_count || 0,
      last_updated_count: latest?.updated_count || 0,
      last_removed_count: latest?.removed_count || 0,
      total_datasets: datasets.length,
      last_error: errors[0] || null,
      error_count: errors.length,
      recent_changes: (recentChanges || []).map((c: any) => ({
        phone_number: c.phone_number,
        operation: c.operation,
        label: c.label,
        version: c.version,
        timestamp: c.timestamp || c.created_date,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}