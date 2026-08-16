import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { regenerateDataset } from '../../shared/callDirectory.ts';

// ADMIN ONLY. Rebuilds the Call Directory dataset: diffs current PhoneReputation
// state against the previously-published dataset, writes the change log, and
// publishes a new dataset version. Has_more=true means the batch cap was hit
// (re-run to continue). Triggered manually from the admin dashboard or by a
// scheduled workflow after reputation data changes.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const result = await regenerateDataset(base44, body.triggered_by || 'manual', {
      maxBatches: Math.min(parseInt(body.max_batches || '50', 10) || 50, 200),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // record the error as a dataset generation failure for admin visibility
    try {
      const base44 = createClientFromRequest(req);
      const latest = await base44.asServiceRole.entities.CallDirectoryDataset.list('-version', 1);
      await base44.asServiceRole.entities.CallDirectoryDataset.create({
        version: (latest[0]?.version || 0) + 1,
        generated_at: new Date().toISOString(),
        status: 'error',
        error_message: error.message,
        triggered_by: 'manual',
        notes: 'generation failed',
      });
    } catch {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}