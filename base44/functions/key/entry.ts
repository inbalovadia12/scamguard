// Apple Live Caller ID Lookup — /key endpoint
// POST /functions/key
//
// Accepts an EvaluationKeys protobuf message and stores each evaluation key
// indexed by (User-Identifier, config-hash).
//
// Headers:
//   User-Identifier: <pseudorandom per-user ID>
//   Authorization: PrivateToken token=<base64-encoded Privacy Pass token>

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import {
  authenticatePrivacyPass,
  getUserIdentifier,
  parseEvaluationKeys,
  storeEvaluationKey,
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

    const userIdentifier = getUserIdentifier(req);
    if (!userIdentifier) {
      return Response.json({ error: "User-Identifier header required" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const body = new Uint8Array(await req.arrayBuffer());
    const keys = parseEvaluationKeys(body);
    if (keys.length === 0) {
      return Response.json({ error: "No evaluation keys in request" }, { status: 400 });
    }

    // Cap stored keys per user_identifier to prevent storage pollution
    // from anonymous callers minting unlimited tokens.
    const MAX_KEYS_PER_USER = 10;
    const existingKeys = await base44.asServiceRole.entities.LiveCallerIdKey.filter({ user_identifier: userIdentifier });
    const existingHashes = new Set((Array.isArray(existingKeys) ? existingKeys : []).map((k) => k.key_config_hash));
    const allNewKeys = keys.every((key) => !existingHashes.has(toBase64(key.identifier)));
    if (existingKeys.length >= MAX_KEYS_PER_USER && allNewKeys) {
      return Response.json({ error: "Key limit exceeded" }, { status: 429 });
    }

    for (const key of keys) {
      const configHashB64 = toBase64(key.identifier);
      const evaluationKeyB64 = toBase64(key.evaluationKey);
      const timestamp = Number(key.timestamp);
      await storeEvaluationKey(base44, userIdentifier, configHashB64, evaluationKeyB64, timestamp);
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}