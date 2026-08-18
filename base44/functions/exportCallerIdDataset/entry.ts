// Apple Live Caller ID — PIR dataset export endpoint
// POST (admin-only)
//
// Exports eligible PhoneReputation records for Apple's Live Caller ID dataset.
// Returns JSON suitable for a local PIR conversion script.
//
// Only authenticated Vardin admins can access this endpoint.
// No private user data, sources, or report counts are exposed.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  normalizePhoneNumber,
  getConfig,
  computeLabel,
  type CallerIdStatus,
} from "../../shared/phoneReputation.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Require authenticated admin access — no anonymous or non-admin calls.
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {}
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const config = await getConfig(base44);
    const minConfidence = config.min_confidence ?? 60;

    const entries: any[] = [];
    const batchSize = 500;
    let offset = 0;

    // Paginate through all PhoneReputation records (admin-only RLS → asServiceRole).
    for (let b = 0; b < 200; b++) {
      const batch = await base44.asServiceRole.entities.PhoneReputation.list(
        "normalized_number",
        batchSize,
        offset,
      );
      if (!batch || batch.length === 0) break;

      for (const rep of batch) {
        // Filter 1: normalized_number must be a valid E.164 number.
        const nn = normalizePhoneNumber(rep.normalized_number);
        if (!nn) continue;

        // Filter 2: record must already be flagged for the Call Directory.
        if (!rep.in_call_directory) continue;

        // Filter 3: caller_id_status must not be UNKNOWN.
        const status: CallerIdStatus = rep.caller_id_status || "UNKNOWN";
        if (status === "UNKNOWN") continue;

        // Filter 4: confidence must meet Vardin's publishing threshold.
        const confidence = rep.confidence_score ?? 0;
        if (confidence < minConfidence) continue;

        // Project only the fields the conversion script needs —
        // no sources, report counts, or other internal reputation data.
        entries.push({
          normalized_number: nn,
          caller_id_status: status,
          caller_id_label: rep.caller_id_label || computeLabel(status, config),
          confidence_score: confidence,
          verified_business: !!rep.verified_business,
          business_name: rep.business_name || "",
          in_call_directory: true,
        });
      }

      if (batch.length < batchSize) break;
      offset += batchSize;
    }

    return Response.json({
      generated_at: new Date().toISOString(),
      min_confidence: minConfidence,
      entry_count: entries.length,
      entries,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}