// Apple Live Caller ID Lookup — Dataset synchronization
// POST (admin-only, or invoked from a scheduled workflow)
//
// Synchronizes PhoneReputation records into a new LiveCallerIdDataset version.
// Only records that meet Vardin's confidence requirements are included.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  buildPirDataset,
  buildPirConfigAndHash,
  getLatestDataset,
} from "../../shared/liveCallerId.ts";
import { toBase64 } from "../../shared/protobuf.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const triggeredBy = user ? "manual" : "auto";

    const { entries, count } = await buildPirDataset(base44);

    const { configId } = await buildPirConfigAndHash(count);
    const configHashB64 = toBase64(configId);

    const latest = await getLatestDataset(base44);
    const newVersion = (latest?.version || 0) + 1;
    const now = new Date().toISOString();

    const bucketCount = Math.max(1024, 1 << Math.ceil(Math.log2(Math.max(count, 1))));

    await base44.asServiceRole.entities.LiveCallerIdDataset.create({
      version: newVersion,
      generated_at: now,
      entry_count: count,
      bucket_count: bucketCount,
      status: "generated",
      triggered_by: triggeredBy,
      config_hash_b64: configHashB64,
      notes: count === 0 ? "empty dataset — no qualifying PhoneReputation records" : "complete",
    });

    return Response.json({
      version: newVersion,
      entry_count: count,
      bucket_count: bucketCount,
      config_hash: configHashB64,
      generated_at: now,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const latest = await base44.asServiceRole.entities.LiveCallerIdDataset.list("-version", 1);
      const newVersion = (latest[0]?.version || 0) + 1;
      await base44.asServiceRole.entities.LiveCallerIdDataset.create({
        version: newVersion,
        generated_at: new Date().toISOString(),
        entry_count: 0,
        status: "error",
        error_message: error.message,
        triggered_by: "auto",
      });
    } catch {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}