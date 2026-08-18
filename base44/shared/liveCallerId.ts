// Live Caller ID Lookup helpers — builds the PIR dataset from PhoneReputation,
// encodes Apple's protobuf protocol messages, and handles authentication.
//
// Architecture:
//   /config   →  ConfigResponse (PIR use-case config + evaluation key status)
//   /key      →  stores EvaluationKeys (evaluation key blobs) by user + config hash
//   /queries  →  evaluates PIR Requests against the dataset, returns Responses
//
// The dataset is a keyword-indexed map: normalized phone number → caller-ID label.
// It is synchronized from PhoneReputation (the canonical reputation index fed by
// Vardin's existing lookupPhoneNumber engine) and refreshed on each dataset version.

import {
  getConfig,
  qualifiesForDataset,
  computeLabel,
  normalizePhoneNumber,
  type CallerIdStatus,
} from "./phoneReputation.ts";
import * as pb from "./protobuf.ts";

export const USE_CASE_NAME = "vardin-caller-id";

// KeyType enum values (from swift-homomorphic-encryption-protobuf)
const KEY_TYPE_BFV = 1;

// ─── Dataset ───────────────────────────────────────────────────────────────

export interface DatasetEntry {
  phoneNumber: string; // normalized E.164 (the PIR keyword)
  label: string; // caller-ID label (the PIR value)
}

export interface PirDataset {
  version: number;
  entries: DatasetEntry[];
  bucketCount: number;
  configHashB64: string;
}

// Load all qualifying PhoneReputation records into a PIR dataset.
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
      if (!label) continue; // UNKNOWN → no entry
      entries.push({ phoneNumber: nn, label });
    }

    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  return { entries, count: entries.length };
}

// Compute the PIR bucket count (next power of 2 ≥ keyword count, min 1024).
export function computeBucketCount(keywordCount: number): number {
  let p = 1024;
  while (p < keywordCount) p <<= 1;
  return p;
}

// ─── Protobuf message encoders ─────────────────────────────────────────────

// KeyConfig { int32 key_id = 1; KeyType key_type = 2; int32 modulus_size = 3; }
export function encodeKeyConfig(keyId: number, modulusSize: number = 1024): Uint8Array {
  return pb.concat(
    pb.encodeInt32Field(1, keyId),
    pb.encodeInt32Field(2, KEY_TYPE_BFV),
    pb.encodeInt32Field(3, modulusSize),
  );
}

// KeyMetadata { bytes identifier = 1; int64 timestamp = 2; }
export function encodeKeyMetadata(identifier: Uint8Array, timestamp: number): Uint8Array {
  return pb.concat(
    pb.encodeBytesField(1, identifier),
    pb.encodeInt64Field(2, timestamp),
  );
}

// KeyStatus { KeyConfig key_config = 1; int64 timestamp = 2; }
export function encodeKeyStatus(keyConfigBytes: Uint8Array, timestamp: number): Uint8Array {
  return pb.concat(
    pb.encodeMessageField(1, keyConfigBytes),
    pb.encodeInt64Field(2, timestamp),
  );
}

// PirConfig {
//   int64 bucket_count = 1;
//   int64 keyword_count = 2;
//   int32 lwe_dimension = 3;
//   int32 plaintext_size = 4;
//   int32 key_count = 5;
//   KeyConfig key_config = 6;
//   bool symmetric = 7;
// }
export function encodePirConfig(
  bucketCount: number,
  keywordCount: number,
  keyConfigBytes: Uint8Array,
  symmetric = false,
): Uint8Array {
  return pb.concat(
    pb.encodeInt64Field(1, bucketCount),
    pb.encodeInt64Field(2, keywordCount),
    pb.encodeInt32Field(3, 1024), // lwe_dimension
    pb.encodeInt32Field(4, 8), // plaintext_size
    pb.encodeInt32Field(5, 1), // key_count
    pb.encodeMessageField(6, keyConfigBytes),
    pb.encodeBoolField(7, symmetric),
  );
}

// Config { PirConfig pir_config = 1; bytes configuration_hash = 2; }
export function encodeConfig(pirConfigBytes: Uint8Array, configHash: Uint8Array): Uint8Array {
  return pb.concat(
    pb.encodeMessageField(1, pirConfigBytes),
    pb.encodeBytesField(2, configHash),
  );
}

// ConfigResponse { map<string, Config> configs = 1; repeated KeyStatus key_info = 2; }
export function encodeConfigResponse(
  configs: Array<[string, Uint8Array]>,
  keyStatuses: Uint8Array[],
): Uint8Array {
  return pb.concat(
    pb.encodeStringMapField(1, configs),
    ...keyStatuses.map((ks) => pb.encodeMessageField(2, ks)),
  );
}

// PirResponse { bytes response = 1; KeyMetadata evaluation_key_metadata = 2; }
export function encodePirResponse(responseBytes: Uint8Array, keyMetadataBytes: Uint8Array): Uint8Array {
  return pb.concat(
    pb.encodeBytesField(1, responseBytes),
    pb.encodeMessageField(2, keyMetadataBytes),
  );
}

// Response { PirResponse pir_response = 1; }
export function encodeResponse(pirResponseBytes: Uint8Array): Uint8Array {
  return pb.encodeMessageField(1, pirResponseBytes);
}

// Responses { repeated Response responses = 1; }
export function encodeResponses(responseBytes: Uint8Array[]): Uint8Array {
  return pb.concat(...responseBytes.map((r) => pb.encodeMessageField(1, r)));
}

// ─── Protobuf message decoders ─────────────────────────────────────────────

// Parse EvaluationKeys { repeated EvaluationKey keys = 1; }
// EvaluationKey { KeyMetadata metadata = 1; bytes evaluation_key = 2; }
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
    // Parse KeyMetadata to get identifier + timestamp
    const metaFields = pb.parseFields(metadata);
    const identifier = (metaFields.get(1)?.[0]?.data as Uint8Array) || new Uint8Array();
    const timestamp = (metaFields.get(2)?.[0]?.data as bigint) || 0n;
    keys.push({ metadata, evaluationKey, identifier, timestamp });
  }
  return keys;
}

// Parse Requests { repeated Request requests = 1; }
// Request { string usecase = 1; oneof request { PirRequest pir_request = 2; OprfRequest oprf_request = 3; } }
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
      pirRequest = {
        evaluationKeyMetadata: (pirFields.get(1)?.[0]?.data as Uint8Array) || new Uint8Array(),
        configurationHash: (pirFields.get(2)?.[0]?.data as Uint8Array) || new Uint8Array(),
        query: (pirFields.get(3)?.[0]?.data as Uint8Array) || new Uint8Array(),
      };
    }
    requests.push({ usecase: usecaseStr, pirRequest });
  }
  return requests;
}

// ─── Authentication ─────────────────────────────────────────────────────────

// Extract the User-Identifier header (pseudorandom per-user ID).
export function getUserIdentifier(req: Request): string {
  return req.headers.get("User-Identifier") || req.headers.get("user-identifier") || "";
}

// Extract the bearer token from the Authorization header.
export function getBearerToken(req: Request): string {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (auth.startsWith("bearer ")) return auth.slice(7).trim();
  return auth.trim();
}

// ─── Privacy-preserving logging ─────────────────────────────────────────────

// Hash a user identifier for logging (never log the raw identifier or phone number).
export async function hashForLog(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(0).slice(0, 16);
}

// ─── Evaluation key persistence ─────────────────────────────────────────────

// Store an evaluation key for a user + config hash.
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
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 days

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

// Retrieve an evaluation key for a user + config hash.
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

// Check if an evaluation key exists for a user + config hash; return its timestamp.
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

// ─── Label lookup ───────────────────────────────────────────────────────────

// Look up a phone number in the PhoneReputation index and return its label.
// This is used by the PIR query evaluation (the keyword is the phone number).
export async function lookupLabel(base44: any, phoneNumber: string): Promise<string> {
  const nn = normalizePhoneNumber(phoneNumber);
  if (!nn) return "";
  const config = await getConfig(base44);
  const existing = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: nn });
  if (existing.length === 0) return "";
  const rep = existing[0];
  if (!qualifiesForDataset(rep, config)) return "";
  return rep.caller_id_label || computeLabel(rep.caller_id_status || "UNKNOWN", config);
}