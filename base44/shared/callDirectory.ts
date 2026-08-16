// Call Directory dataset generation + incremental change-log helpers.
//
// The dataset is a versioned, published view of PhoneReputation. regenerateDataset
// diffs the current reputation state against the previously-published state
// (in_call_directory / caller_id_label) and writes ADD / UPDATE / REMOVE changes
// for the new dataset version. The future iOS Call Directory Extension downloads
// a snapshot once, then polls for changes since the last version it has.

import {
  getConfig,
  computeLabel,
  qualifiesForDataset,
} from "./phoneReputation.ts";

// Regenerate the Call Directory dataset. Processes PhoneReputation in batches to
// handle large datasets. Returns a summary; has_more=true means the configured
// batch cap was hit (re-run to continue, or raise max_batches).
export async function regenerateDataset(base44: any, triggeredBy = "manual", opts: any = {}): Promise<any> {
  const config = await getConfig(base44);
  const batchSize = 500;
  const maxBatches = opts.maxBatches ?? 50; // up to 25,000 records per invocation

  const latestDs = await base44.asServiceRole.entities.CallDirectoryDataset.list("-version", 1);
  const newVersion = (latestDs[0]?.version || 0) + 1;
  const now = new Date().toISOString();

  let processed = 0;
  let added = 0, updated = 0, removed = 0;
  let entryCount = 0;
  let hasMore = false;

  const changes: any[] = [];
  const repPatches: any[] = [];

  for (let b = 0; b < maxBatches; b++) {
    const batch = await base44.asServiceRole.entities.PhoneReputation.list("created_date", batchSize, b * batchSize);
    if (!batch || batch.length === 0) { hasMore = false; break; }

    for (const rep of batch) {
      processed++;
      const shouldIn = qualifiesForDataset(rep, config);
      if (shouldIn) entryCount++;
      const wasIn = !!rep.in_call_directory;
      const newLabel = shouldIn ? computeLabel(rep.caller_id_status, config) : "";
      const oldLabel = rep.caller_id_label || "";

      let op: "ADD" | "UPDATE" | "REMOVE" | null = null;
      if (shouldIn && !wasIn) op = "ADD";
      else if (shouldIn && wasIn && newLabel !== oldLabel) op = "UPDATE";
      else if (!shouldIn && wasIn) op = "REMOVE";

      if (op) {
        changes.push({
          version: newVersion,
          phone_number: rep.normalized_number,
          display_number: rep.phone_number,
          operation: op,
          label: op === "REMOVE" ? "" : newLabel,
          previous_label: oldLabel,
          status: rep.caller_id_status || "UNKNOWN",
          timestamp: now,
        });
        if (op === "ADD") added++;
        else if (op === "UPDATE") updated++;
        else removed++;
      }

      repPatches.push({
        id: rep.id,
        in_call_directory: shouldIn,
        caller_id_label: shouldIn ? newLabel : "",
        dataset_version: op ? newVersion : (rep.dataset_version || 0),
        last_updated_at: now,
      });
    }

    if (batch.length < batchSize) { hasMore = false; break; }
    if (b + 1 >= maxBatches) { hasMore = true; break; }
  }

  // bulk-write change log (500 per call)
  for (let i = 0; i < changes.length; i += 500) {
    await base44.asServiceRole.entities.CallDirectoryChange.bulkCreate(changes.slice(i, i + 500));
  }
  // bulk-update reputation publication flags (500 per call)
  for (let i = 0; i < repPatches.length; i += 500) {
    await base44.asServiceRole.entities.PhoneReputation.bulkUpdate(repPatches.slice(i, i + 500));
  }

  await base44.asServiceRole.entities.CallDirectoryDataset.create({
    version: newVersion,
    generated_at: now,
    entry_count: entryCount,
    status: "generated",
    added_count: added,
    updated_count: updated,
    removed_count: removed,
    triggered_by: triggeredBy || "manual",
    notes: hasMore ? "partial — re-run to continue" : "complete",
  });

  return { version: newVersion, processed, added, updated, removed, entry_count: entryCount, has_more: hasMore };
}