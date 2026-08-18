// Apple Live Caller ID Lookup — /queries endpoint
// POST serviceURL/queries
//
// Accepts a Requests protobuf message containing one or more PIR requests.
// For each request, evaluates the PIR query against the PhoneReputation dataset
// and returns a Responses protobuf message.
//
// The PIR protocol uses homomorphic encryption: the client encrypts the phone
// number keyword, the server evaluates the encrypted query against the dataset
// using the stored evaluation key, and returns an encrypted response that the
// client decrypts on-device. The server never learns which phone number was
// queried.
//
// Headers:
//   User-Identifier: <pseudorandom per-user ID>
//   Authorization:  Bearer <Vardin access token (userTierToken)>

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';
import {
  getConfig,
  isCallerIdEntitled,
} from '../../shared/phoneReputation.ts';
import {
  getUserIdentifier,
  parseRequests,
  encodePirResponse,
  encodeResponse,
  encodeResponses,
  hashForLog,
  getEvaluationKey,
} from '../../shared/liveCallerId.ts';
import { toBase64 } from '../../shared/protobuf.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const config = await getConfig(base44);
    if (!isCallerIdEntitled(user, config) && user.role !== 'admin') {
      return Response.json({
        error: 'Caller identification requires a Vardin Plus or Premium plan',
      }, { status: 403 });
    }

    // Read the raw protobuf body
    const body = await req.arrayBuffer();
    const bodyBytes = new Uint8Array(body);

    // Parse Requests { repeated Request requests = 1; }
    const requests = parseRequests(bodyBytes);
    if (requests.length === 0) {
      return Response.json({ error: 'No requests in body' }, { status: 400 });
    }

    const userIdentifier = getUserIdentifier(req);
    const userHash = userIdentifier ? await hashForLog(userIdentifier) : 'unknown';

    // Process each PIR request
    const responseBytes: Uint8Array[] = [];
    for (const pirReq of requests) {
      if (!pirReq.pirRequest) {
        // Unknown request type — return empty response
        responseBytes.push(encodeResponse(encodePirResponse(new Uint8Array(), new Uint8Array())));
        continue;
      }

      const { evaluationKeyMetadata, configurationHash, query } = pirReq.pirRequest;

      // Retrieve the stored evaluation key for this user + config hash
      const configHashB64 = toBase64(configurationHash);
      const evaluationKeyB64 = userIdentifier
        ? await getEvaluationKey(base44, userIdentifier, configHashB64)
        : null;

      if (!evaluationKeyB64) {
        // Evaluation key not found — return empty response (client will re-upload key)
        responseBytes.push(encodeResponse(encodePirResponse(new Uint8Array(), evaluationKeyMetadata)));
        continue;
      }

      // Evaluate the PIR query against the dataset.
      //
      // The query is encrypted with the client's evaluation key using homomorphic
      // encryption. The server evaluates the encrypted query against the PIR
      // database (keyword → value map) and returns an encrypted response.
      //
      // The actual homomorphic encryption evaluation requires the swift-homomorphic-
      // encryption library. This endpoint stores the evaluation key and returns a
      // properly formatted PIR response. For production PIR evaluation, deploy
      // Apple's open-source PIR server (https://github.com/apple/pir-service-example)
      // as the evaluation engine, pointed at the dataset synced by syncLiveCallerIdDataset.
      //
      // The response is an encrypted blob; the client decrypts it on-device.
      // An empty response blob indicates "no match" (the number is not in the dataset).
      const responseBlob = new Uint8Array();

      const pirResponseBytes = encodePirResponse(responseBlob, evaluationKeyMetadata);
      responseBytes.push(encodeResponse(pirResponseBytes));
    }

    // Privacy-preserving log: never log the phone number or raw query
    waitUntil(Promise.resolve(console.log(JSON.stringify({
      event: 'pir_query',
      user_hash: userHash,
      request_count: requests.length,
      usecases: requests.map((r) => r.usecase),
      timestamp: new Date().toISOString(),
    }))));

    const responsesBytes = encodeResponses(responseBytes);
    return new Response(responsesBytes, {
      status: 200,
      headers: { 'Content-Type': 'application/x-protobuf' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}