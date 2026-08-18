// Apple Live Caller ID Lookup — Dataset synchronization
// POST (admin-only, or invoked from a scheduled workflow)
//
// Synchronizes PhoneReputation records into a new LiveCallerIdDataset version.
// Only records that meet Vardin's confidence requirements are included.
// The PIR configuration (bucket count, keyword count, key config) and its
// SHA-256 hash are stored with the dataset version. The config hash identifies
// which evaluation keys are valid for this dataset version.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  buildPirDataset,
  computeBucketCount,
  encodeKeyConfig,
  encodePirConfig,
  getLatestDataset,
} from '../../shared/liveCallerId.ts';
import { sha256, toBase64 } from '../../shared/protobuf.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Allow both admin users (manual trigger) and workflow calls (no user context)
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    const triggeredBy = user ? 'manual' : 'auto';

    // Build the PIR dataset from PhoneReputation
    const { entries, count } = await buildPirDataset(base44);

    // Compute the PIR config + config hash
    const bucketCount = computeBucketCount(count);
    const keyConfigBytes = encodeKeyConfig(1);
    const pirConfigBytes = encodePirConfig(bucketCount, count, keyConfigBytes);
    const configHash = await sha256(pirConfigBytes);
    const configHashB64 = toBase64(configHash);

    // Create a new dataset version
    const latest = await getLatestDataset(base44);
    const newVersion = (latest?.version || 0) + 1;
    const now = new Date().toISOString();

    await base44.asServiceRole.entities.LiveCallerIdDataset.create({
      version: newVersion,
      generated_at: now,
      entry_count: count,
      bucket_count: bucketCount,
      status: 'generated',
      triggered_by: triggeredBy,
      config_hash_b64: configHashB64,
      notes: count === 0 ? 'empty dataset — no qualifying PhoneReputation records' : 'complete',
    });

    return Response.json({
      version: newVersion,
      entry_count: count,
      bucket_count: bucketCount,
      config_hash: configHashB64,
      generated_at: now,
    });
  } catch (error) {
    // Record the error as a failed dataset version
    try {
      const base44 = createClientFromRequest(req);
      const latest = await base44.asServiceRole.entities.LiveCallerIdDataset.list('-version', 1);
      const newVersion = (latest[0]?.version || 0) + 1;
      await base44.asServiceRole.entities.LiveCallerIdDataset.create({
        version: newVersion,
        generated_at: new Date().toISOString(),
        entry_count: 0,
        status: 'error',
        error_message: error.message,
        triggered_by: triggeredBy || 'auto',
      });
    } catch {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}