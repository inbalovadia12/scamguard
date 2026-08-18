// Live Caller ID Lookup — PIR dataset management and Apple protobuf protocol.
//
// Endpoints:
//   /config   →  ConfigResponse (PIR use-case config + evaluation key status)
//   /key      →  stores EvaluationKeys by user + config hash
//   /queries  →  evaluates PIR Requests, returns Responses
//
// The dataset is a keyword-indexed map: normalized phone number → caller-ID label.
// It is synchronized from PhoneReputation (the canonical reputation index fed by
// Vardin's existing lookupPhoneNumber engine) and refreshed on each dataset version.
//
// Protobuf messages match apple/swift-homomorphic-encryption-protobuf definitions:
//   api/v1/api.proto, api/shared/v1/api_shared.proto, api/pir/v1/pir.proto,
//   v1/he.proto, v1/error_stddev.proto, pir/v1/pir_algorithm.proto

import {
  getConfig,
  qualifiesForDataset,
  computeLabel,
  normalizePhoneNumber,
  type CallerIdStatus,
} from "./phoneReputation.ts";
import { loadRsaKey, verifyToken, extractPrivateToken, type RsaKeyMaterial } from "./privacyPass.ts";
import * as pb from "./protobuf.ts";

export const USE_CASE_NAME = "vardin-caller-id";

// Enum values from Apple's proto definitions
const HE_SCHEME_BFV = 1;
const SECURITY_LEVEL_QUANTUM128 = 1;
const ERROR_STD_DEV_STDDEV32 = 0;
const PIR_ALGORITHM_MUL_PIR = 1;

// ─── Dataset ───────────────────────────────────────────────────────────────

export interface DatasetEntry {
  phoneNumber: string;
  label: string;
}

export async function buildPirDataset(base44: any): Promise<{ entries: DatasetEntry[]; count: number }> {
  const config = await getConfig(base44);
  const entries: DatasetEntry[] = [];
  const batchSize = 500;
  let offset = 0;

  for (let b = 0; b < 200; b++) {
    const batch = await base44.asServiceRole.entities.PhoneReputation.list("normalized_number", batchSize, offset);
    if (!batch || batch.length === 0) break;
    for (const rep of batch) {
      if (!qualifiesForDataset(rep, config)) continue;
      const nn = rep.normalized_number;
      if (!nn) continue;
      const status: CallerIdStatus = rep.caller_id_status || "UNKNOWN";
      const label = rep.caller_id_label || computeLabel(status, config);
      if (!label) continue;
      entries.push({ phoneNumber: nn, label });
    }
    if (batch.length < batchSize) break;
    offset += batchSize;
  }
  return { entries, count: entries.length };
}

// ─── Privacy Pass authentication ────────────────────────────────────────────

// Validate the Privacy Pass token from the Authorization header.
// Returns the RsaKeyMaterial if valid, null otherwise.
export async function authenticatePrivacyPass(req: Request, secretValue: string): Promise<RsaKeyMaterial | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = extractPrivateToken(authHeader);
  if (!token) return null;

  const keyMaterial = await loadRsaKey(secretValue);
  const valid = await verifyToken(token, keyMaterial.n, keyMaterial.e, keyMaterial.tokenKeyId);
  return valid ? keyMaterial : null;
}

// ─── Protobuf encoders ──────────────────────────────────────────────────────

// EncryptionParameters (he.proto)
function encodeEncryptionParameters(polynomialDegree: number, plaintextModulus: number, coefficientModuli: number[]): Uint8Array {
  return pb.concat(
    pb.encodeInt64Field(1, polynomialDegree),
    pb.encodeInt64Field(2, plaintextModulus),
    pb.encodePackedInt64Field(3, coefficientModuli),
    pb.encodeInt32Field(4, ERROR_STD_DEV_STDDEV32),
    pb.encodeInt32Field(5, SECURITY_LEVEL_QUANTUM128),
    pb.encodeInt32Field(6, HE_SCHEME_BFV),
  );
}

// EvaluationKeyConfig (he.proto)
function encodeEvaluationKeyConfig(encParams: Uint8Array, galoisElements: number[], hasRelinKey: boolean): Uint8Array {
  return pb.concat(
    pb.encodeMessageField(1, encParams),
    pb.encodePackedInt32Field(2, galoisElements),
    pb.encodeBoolField(3, hasRelinKey),
  );
}

// PIRShardConfig (pir.proto)
function encodePirShardConfig(numEntries: number, entrySize: number, dimensions: number[]): Uint8Array {
  return pb.concat(
    pb.encodeInt64Field(1, numEntries),
    pb.encodeInt64Field(2, entrySize),
    pb.encodePackedInt64Field(3, dimensions),
  );
}

// KeywordPirParameters (pir.proto)
function encodeKeywordPirParameters(numHashFunctions: number): Uint8Array {
  return pb.encodeInt64Field(1, numHashFunctions);
}

// PIRConfig (pir.proto)
function encodePirConfig(
  encParams: Uint8Array,
  shardConfigs: Uint8Array[],
  keywordPirParams: Uint8Array,
  algorithm: number,
  batchSize: number,
  evalKeyConfigHash: Uint8Array,
): Uint8Array {
  return pb.concat(
    pb.encodeMessageField(1, encParams),
    ...shardConfigs.map((sc) => pb.encodeMessageField(2, sc)),
    pb.encodeMessageField(3, keywordPirParams),
    pb.encodeInt32Field(4, algorithm),
    pb.encodeInt64Field(5, batchSize),
    pb.encodeBytesField(6, evalKeyConfigHash),
  );
}

// Config (api.proto)
function encodeConfig(pirConfigBytes: Uint8Array, configId: Uint8Array): Uint8Array {
  return pb.concat(
    pb.encodeMessageField(1, pirConfigBytes),
    pb.encodeBytesField(3, configId),
  );
}

// KeyStatus (api_shared.proto) — field 1: timestamp, field 2: EvaluationKeyConfig
function encodeKeyStatus(timestamp: number, evalKeyConfigBytes: Uint8Array): Uint8Array {
  return pb.concat(
    pb.encodeInt64Field(1, timestamp),
    pb.encodeMessageField(2, evalKeyConfigBytes),
  );
}

// ConfigResponse (api.proto) — map<string, Config> configs = 1; repeated KeyStatus key_info = 2;
export function encodeConfigResponse(
  configs: Array<[string, Uint8Array]>,
  keyStatuses: Uint8Array[],
): Uint8Array {
  return pb.concat(
    pb.encodeStringMapField(1, configs),
    ...keyStatuses.map((ks) => pb.encodeMessageField(2, ks)),
  );
}

// PIRResponse (pir.proto) — repeated SerializedCiphertextVec replies = 1; StashOfEntries stash = 2;
export function encodePirResponse(): Uint8Array {
  // Empty response: no replies, no stash → indicates "no match"
  return new Uint8Array(0);
}

// Response (api.proto) — oneof response { PIRResponse pir_response = 1; }
export function encodeResponse(pirResponseBytes: Uint8Array): Uint8Array {
  return pb.encodeMessageField(1, pirResponseBytes);
}

// Responses (api.proto) — repeated Response responses = 1;
export function encodeResponses(responseBytes: Uint8Array[]): Uint8Array {
  return pb.concat(...responseBytes.map((r) => pb.encodeMessageField(1, r)));
}

// Error (api.proto)
export function encodeError(errorType: number): Uint8Array {
  // Error { oneof error_type { ConfigVersionNotFound config_version_not_found = 1; EvaluationKeyNotFound evaluation_key_not_found = 2; InvalidRequest invalid_request = 3; InternalError internal_error = 4; } }
  // Each error type is an empty message, so we just encode the field number
  return pb.encodeMessageField(errorType, new Uint8Array(0));
}

// ─── Protobuf decoders ──────────────────────────────────────────────────────

// Parse EvaluationKeys { repeated EvaluationKey keys = 1; }
// EvaluationKey { EvaluationKeyMetadata metadata = 1; SerializedEvaluationKey evaluation_key = 2; }
// EvaluationKeyMetadata { uint64 timestamp = 1; bytes identifier = 2; }
export function parseEvaluationKeys(data: Uint8Array): Array<{
  metadata: Uint8Array;
  evaluationKey: Uint8Array;
  identifier: Uint8Array;
  timestamp: bigint;
}> {
  const fields = pb.parseFields(data);
  const keys: Array<{ metadata: Uint8Array; evaluationKey: Uint8Array; identifier: Uint8Array; timestamp: bigint }> = [];
  const keyEntries = fields.get(1) || [];
  for (const entry of keyEntries) {
    if (!(entry.data instanceof Uint8Array)) continue;
    const keyFields = pb.parseFields(entry.data);
    const metadata = (keyFields.get(1)?.[0]?.data as Uint8Array) || new Uint8Array();
    const evaluationKey = (keyFields.get(2)?.[0]?.data as Uint8Array) || new Uint8Array();
    // Parse EvaluationKeyMetadata: field 1 = timestamp (uint64), field 2 = identifier (bytes)
    const metaFields = pb.parseFields(metadata);
    const timestamp = (metaFields.get(1)?.[0]?.data as bigint) || 0n;
    const identifier = (metaFields.get(2)?.[0]?.data as Uint8Array) || new Uint8Array();
    keys.push({ metadata, evaluationKey, identifier, timestamp });
  }
  return keys;
}

// Parse Requests { repeated Request requests = 1; }
// Request { string usecase = 1; oneof request { PIRRequest pir_request = 2; ... } }
// PIRRequest { uint32 shard_index = 1; EncryptedIndices query = 2; EvaluationKeyMetadata evaluation_key_metadata = 3; bytes configuration_hash = 4; }
export function parseRequests(data: Uint8Array): Array<{
  usecase: string;
  pirRequest?: { evaluationKeyMetadata: Uint8Array; configurationHash: Uint8Array; query: Uint8Array };
}> {
  const fields = pb.parseFields(data);
  const requests: Array<{ usecase: string; pirRequest?: any }> = [];
  const requestEntries = fields.get(1) || [];
  for (const entry of requestEntries) {
    if (!(entry.data instanceof Uint8Array)) continue;
    const reqFields = pb.parseFields(entry.data);
    const usecase = reqFields.get(1)?.[0]?.data;
    const usecaseStr = usecase instanceof Uint8Array ? new TextDecoder().decode(usecase) : "";
    const pirRequestData = reqFields.get(2)?.[0]?.data as Uint8Array | undefined;
    let pirRequest: any = undefined;
    if (pirRequestData) {
      const pirFields = pb.parseFields(pirRequestData);
      // PIRRequest: shard_index=1, query=2, evaluation_key_metadata=3, configuration_hash=4
      pirRequest = {
        query: (pirFields.get(2)?.[0]?.data as Uint8Array) || new Uint8Array(),
        evaluationKeyMetadata: (pirFields.get(3)?.[0]?.data as Uint8Array) || new Uint8Array(),
        configurationHash: (pirFields.get(4)?.[0]?.data as Uint8Array) || new Uint8Array(),
      };
    }
    requests.push({ usecase: usecaseStr, pirRequest });
  }
  return requests;
}

// ─── Authentication helpers ──────────────────────────────────────────────────

export function getUserIdentifier(req: Request): string {
  return req.headers.get("User-Identifier") || req.headers.get("user-identifier") || "";
}

export async function hashForLog(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ─── Evaluation key persistence ──────────────────────────────────────────────

export async function storeEvaluationKey(
  base44: any,
  userIdentifier: string,
  configHashB64: string,
  evaluationKeyB64: string,
  timestamp: number,
): Promise<void> {
  const existing = await base44.asServiceRole.entities.LiveCallerIdKey.filter({
    user_identifier: userIdentifier,
    key_config_hash: configHashB64,
  });
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  if (existing.length > 0) {
    await base44.asServiceRole.entities.LiveCallerIdKey.update(existing[0].id, {
      evaluation_key_b64: evaluationKeyB64,
      key_timestamp: timestamp,
      expires_at: expiresAt,
    });
  } else {
    await base44.asServiceRole.entities.LiveCallerIdKey.create({
      user_identifier: userIdentifier,
      key_config_hash: configHashB64,
      evaluation_key_b64: evaluationKeyB64,
      key_timestamp: timestamp,
      expires_at: expiresAt,
    });
  }
}

export async function getEvaluationKey(
  base44: any,
  userIdentifier: string,
  configHashB64: string,
): Promise<string | null> {
  const existing = await base44.asServiceRole.entities.LiveCallerIdKey.filter({
    user_identifier: userIdentifier,
    key_config_hash: configHashB64,
  });
  if (existing.length === 0) return null;
  return existing[0].evaluation_key_b64;
}

export async function getKeyTimestamp(
  base44: any,
  userIdentifier: string,
  configHashB64: string,
): Promise<number> {
  const existing = await base44.asServiceRole.entities.LiveCallerIdKey.filter({
    user_identifier: userIdentifier,
    key_config_hash: configHashB64,
  });
  if (existing.length === 0) return 0;
  return existing[0].key_timestamp || 0;
}

// ─── Dataset version management ────────────────────────────────────────────

export async function getLatestDataset(base44: any): Promise<any> {
  const rows = await base44.asServiceRole.entities.LiveCallerIdDataset.list("-version", 1);
  return rows[0] || null;
}

// ─── Config building ────────────────────────────────────────────────────────

// Build the PIRConfig and compute its config_id (SHA-256 hash).
export async function buildPirConfigAndHash(
  keywordCount: number,
  entrySize: number = 64,
): Promise<{ pirConfigBytes: Uint8Array; configId: Uint8Array; evalKeyConfigHash: Uint8Array }> {
  // Fixed encryption parameters suitable for BFV keyword PIR
  const polynomialDegree = 2048;
  const plaintextModulus = 65537;
  const coefficientModuli = [36028797018963969, 36028797018963937];
  const galoisElements = [1, 3, 5, 7, 9, 11, 13, 15];

  const encParams = encodeEncryptionParameters(polynomialDegree, plaintextModulus, coefficientModuli);
  const evalKeyConfig = encodeEvaluationKeyConfig(encParams, galoisElements, true);
  const evalKeyConfigHash = await pb.sha256(evalKeyConfig);

  const dimensions = [Math.max(keywordCount, 1)];
  const shardConfig = encodePirShardConfig(Math.max(keywordCount, 1), entrySize, dimensions);
  const keywordPirParams = encodeKeywordPirParameters(3);

  const pirConfigBytes = encodePirConfig(
    encParams,
    [shardConfig],
    keywordPirParams,
    PIR_ALGORITHM_MUL_PIR,
    1,
    evalKeyConfigHash,
  );

  const configId = await pb.sha256(pirConfigBytes);

  return { pirConfigBytes, configId, evalKeyConfigHash };
}