// Apple Live Caller ID Lookup — /queries endpoint
// POST /functions/queries
//
// Accepts a Requests protobuf message containing one or more PIR requests.
// For each request, looks up the stored evaluation key and returns a Responses
// protobuf message.
//
// The actual PIR evaluation (homomorphic encryption) requires Apple's
// swift-homomorphic-encryption library. This endpoint validates the request,
// retrieves the evaluation key, and returns a properly structured response.
// An empty PIR response indicates "no match" (the number is not in the dataset).
//
// Headers:
//   User-Identifier: <pseudorandom per-user ID>
//   Authorization: PrivateToken token=<base64-encoded Privacy Pass token>

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import {
  authenticatePrivacyPass,
  getUserIdentifier,
  parseRequests,
  getEvaluationKey,
  encodePirResponse,
  encodeResponse,
  encodeResponses,
  hashForLog,
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

    const body = new Uint8Array(await req.arrayBuffer());
    const requests = parseRequests(body);
    if (requests.length === 0) {
      return Response.json({ error: "No requests in body" }, { status: 400 });
    }

    const userIdentifier = getUserIdentifier(req);
    const userHash = userIdentifier ? await hashForLog(userIdentifier) : "unknown";

    const responseBytes: Uint8Array[] = [];
    for (const pirReq of requests) {
      if (!pirReq.pirRequest) {
        responseBytes.push(encodeResponse(encodePirResponse()));
        continue;
      }

      const { configurationHash } = pirReq.pirRequest;

      const configHashB64 = toBase64(configurationHash);
      const evaluationKeyB64 = userIdentifier
        ? await getEvaluationKey(base44, userIdentifier, configHashB64)
        : null;

      if (!evaluationKeyB64) {
        // Evaluation key not found — return empty PIR response
        responseBytes.push(encodeResponse(encodePirResponse()));
        continue;
      }

      // PIR evaluation requires homomorphic encryption (Apple's swift-homomorphic-encryption).
      // Return an empty PIR response (no match) until a PIR evaluation server is deployed.
      responseBytes.push(encodeResponse(encodePirResponse()));
    }

    console.log(JSON.stringify({
      event: "pir_query",
      user_hash: userHash,
      request_count: requests.length,
      usecases: requests.map((r) => r.usecase),
      timestamp: new Date().toISOString(),
    }));

    const responsesBytes = encodeResponses(responseBytes);
    return new Response(responsesBytes, {
      status: 200,
      headers: { "Content-Type": "application/x-protobuf" },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}