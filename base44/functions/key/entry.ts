// Apple Live Caller ID Lookup — /key endpoint
// POST serviceURL/key
//
// Accepts an EvaluationKeys protobuf message and stores each evaluation key
// indexed by (User-Identifier, config-hash). The key is later retrieved during
// /queries to evaluate PIR requests.
//
// Headers:
//   User-Identifier: <pseudorandom per-user ID>
//   Authorization:  Bearer <Vardin access token (userTierToken)>

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getConfig,
  isCallerIdEntitled,
} from '../../shared/phoneReputation.ts';
import {
  getUserIdentifier,
  getBearerToken,
  parseEvaluationKeys,
  storeEvaluationKey,
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

    const userIdentifier = getUserIdentifier(req);
    if (!userIdentifier) {
      return Response.json({ error: 'User-Identifier header required' }, { status: 400 });
    }

    // Read the raw protobuf body
    const body = await req.arrayBuffer();
    const bodyBytes = new Uint8Array(body);

    // Parse EvaluationKeys { repeated EvaluationKey keys = 1; }
    const keys = parseEvaluationKeys(bodyBytes);
    if (keys.length === 0) {
      return Response.json({ error: 'No evaluation keys in request' }, { status: 400 });
    }

    // Store each evaluation key
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