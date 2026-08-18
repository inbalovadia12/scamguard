// Apple Live Caller ID Lookup — /config endpoint
// POST /functions/config
//
// Returns a ConfigResponse protobuf with the PIR use-case configuration
// and the status of evaluation keys previously uploaded by this device.
//
// Headers:
//   User-Identifier: <pseudorandom per-user ID>
//   Authorization: PrivateToken token=<base64-encoded Privacy Pass token>

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import {
  authenticatePrivacyPass,
  getUserIdentifier,
  getKeyTimestamp,
  getLatestDataset,
  buildPirConfigAndHash,
  encodeConfig,
  encodeKeyStatus,
  encodeConfigResponse,
  encodeEvaluationKeyConfigFromConfig,
} from "../../shared/liveCallerId.ts";
import { toBase64 } from "../../shared/protobuf.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    if (!secretValue) {
      return Response.json({ error: "Token issuer not configured" }, { status: 500 });
    }

    const keyMaterial = await authenticatePrivacyPass(req, secretValue);
    if (!keyMaterial) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    const dataset = await getLatestDataset(base44);
    const keywordCount = dataset?.entry_count || 0;

    const { pirConfigBytes, configId } = await buildPirConfigAndHash(keywordCount);
    const configIdB64 = toBase64(configId);

    const configBytes = encodeConfig(pirConfigBytes, configId);

    const userIdentifier = getUserIdentifier(req);
    const keyTimestamp = userIdentifier
      ? await getKeyTimestamp(base44, userIdentifier, configIdB64)
      : 0;

    const evalKeyConfigBytes = encodeEvaluationKeyConfigFromConfig(pirConfigBytes);
    const keyStatusBytes = encodeKeyStatus(keyTimestamp, evalKeyConfigBytes);

    const configResponseBytes = encodeConfigResponse(
      [["vardin-caller-id", configBytes]],
      [keyStatusBytes],
    );

    return new Response(configResponseBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/x-protobuf",
        "X-Vardin-Dataset-Version": String(dataset?.version || 0),
        "X-Vardin-Entry-Count": String(keywordCount),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}