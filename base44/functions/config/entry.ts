// Apple Live Caller ID Lookup — /config endpoint
// POST serviceURL/config
//
// Returns a ConfigResponse protobuf with the PIR use-case configuration
// (bucket count, keyword count, evaluation key config) and the status of
// evaluation keys previously uploaded by this device.
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
  USE_CASE_NAME,
  computeBucketCount,
  encodeKeyConfig,
  encodePirConfig,
  encodeConfig,
  encodeConfigResponse,
  encodeKeyStatus,
  getKeyTimestamp,
  getUserIdentifier,
  getLatestDataset,
} from '../../shared/liveCallerId.ts';
import { sha256, toBase64 } from '../../shared/protobuf.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const config = await getConfig(base44);
    if (!isCallerIdEntitled(user, config) && user.role !== 'admin') {
      return Response.json({
        error: 'Caller identification requires a Vardin Plus or Premium plan',
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 403 });
    }

    // Dataset version determines keyword count + bucket count
    const dataset = await getLatestDataset(base44);
    const keywordCount = dataset?.entry_count || 0;
    const bucketCount = computeBucketCount(keywordCount);

    // Build the PIR config + config hash
    const keyConfigBytes = encodeKeyConfig(1);
    const pirConfigBytes = encodePirConfig(bucketCount, keywordCount, keyConfigBytes);
    const configHash = await sha256(pirConfigBytes);
    const configHashB64 = toBase64(configHash);
    const configBytes = encodeConfig(pirConfigBytes, configHash);

    // Check if the device has uploaded an evaluation key for this config
    const userIdentifier = getUserIdentifier(req);
    const keyTimestamp = userIdentifier
      ? await getKeyTimestamp(base44, userIdentifier, configHashB64)
      : 0;
    const keyStatusBytes = encodeKeyStatus(keyConfigBytes, keyTimestamp);

    // ConfigResponse { map<string, Config> configs = 1; repeated KeyStatus key_info = 2; }
    const configResponseBytes = encodeConfigResponse(
      [[USE_CASE_NAME, configBytes]],
      [keyStatusBytes],
    );

    return new Response(configResponseBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-protobuf',
        'X-Vardin-Dataset-Version': String(dataset?.version || 0),
        'X-Vardin-Entry-Count': String(keywordCount),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}