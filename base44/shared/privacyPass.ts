// Privacy Pass protocol implementation for Apple Live Caller ID Lookup.
//
// Implements RFC 9578 (Privacy Pass) blind RSA token issuance and verification,
// matching Apple's pir-service-example PrivacyPass module:
//   - Token type 0x0002 (Blind RSA, 2048-bit, SHA-384, PSS, salt 48)
//   - TokenRequest: uint16 token_type | uint8 truncated_token_key_id | uint8[256] blinded_msg
//   - TokenResponse: uint8[256] blind_sig
//   - Token: uint16 token_type | uint8[32] nonce | uint8[32] challenge_digest | uint8[32] token_key_id | uint8[256] authenticator
//
// The blind RSA signing operation is raw modular exponentiation: blind_sig = blinded_msg^d mod n.
// Token verification uses standard RSA-PSS verification (SHA-384, salt 48).

// ─── BigInt helpers ──────────────────────────────────────────────────────────

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const b of bytes) result = (result << 8n) | BigInt(b);
  return result;
}

export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function base64urlToBigInt(b64url: string): bigint {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytesToBigInt(bytes);
}

function bigIntToBase64Url(value: bigint): string {
  const hex = value.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  const bytes = Uint8Array.from(padded.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── DER encoding ────────────────────────────────────────────────────────────

function derLength(length: number): Uint8Array {
  if (length < 0x80) return new Uint8Array([length]);
  if (length < 0x100) return new Uint8Array([0x81, length]);
  if (length < 0x10000) return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
  throw new Error("DER length too long");
}

function derTag(tag: number, content: Uint8Array): Uint8Array {
  const len = derLength(content.length);
  const result = new Uint8Array(1 + len.length + content.length);
  result[0] = tag;
  result.set(len, 1);
  result.set(content, 1 + len.length);
  return result;
}

function derSequence(...items: Uint8Array[]): Uint8Array {
  return derTag(0x30, concat(...items));
}

function derInteger(value: bigint): Uint8Array {
  if (value === 0n) return derTag(0x02, new Uint8Array([0]));
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  if (bytes[0] & 0x80) bytes = concat(new Uint8Array([0]), bytes);
  return derTag(0x02, bytes);
}

function derOID(oid: string): Uint8Array {
  const parts = oid.split(".").map(Number);
  const encoded: number[] = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v < 128) {
      encoded.push(v);
    } else {
      const tmp: number[] = [];
      tmp.push(v & 0x7f);
      v >>= 7;
      while (v > 0) {
        tmp.push((v & 0x7f) | 0x80);
        v >>= 7;
      }
      tmp.reverse();
      encoded.push(...tmp);
    }
  }
  return derTag(0x06, new Uint8Array(encoded));
}

function derBitString(content: Uint8Array): Uint8Array {
  return derTag(0x03, concat(new Uint8Array([0]), content));
}

function derExplicit(tag: number, content: Uint8Array): Uint8Array {
  return derTag(0xa0 | tag, content);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ─── SPKI construction ───────────────────────────────────────────────────────

// Build DER-encoded SubjectPublicKeyInfo with RSA-PSS / SHA-384 / MGF1-SHA-384 / salt 48.
// This matches Apple's PrivacyPass.PublicKey SPKI format exactly.
export function buildRsaPssSpki(n: bigint, e: bigint): Uint8Array {
  const OID_RSA_PSS = "1.2.840.113549.1.1.10";
  const OID_SHA384 = "2.16.840.1.101.3.4.2.2";
  const OID_MGF1 = "1.2.840.113549.1.1.8";

  const hashAlg = derExplicit(0, derSequence(derOID(OID_SHA384)));
  const maskGenAlg = derExplicit(1, derSequence(derOID(OID_MGF1), derSequence(derOID(OID_SHA384))));
  const saltLen = derExplicit(2, derInteger(48n));
  const trailerField = derExplicit(3, derInteger(1n));
  const pssParams = derSequence(hashAlg, maskGenAlg, saltLen, trailerField);
  const algorithmIdentifier = derSequence(derOID(OID_RSA_PSS), pssParams);
  const rsaPublicKey = derSequence(derInteger(n), derInteger(e));
  const subjectPublicKey = derBitString(rsaPublicKey);
  return derSequence(algorithmIdentifier, subjectPublicKey);
}

// ─── Key loading ────────────────────────────────────────────────────────────

export interface RsaKeyMaterial {
  n: bigint;
  e: bigint;
  d: bigint;
  spki: Uint8Array;
  tokenKeyId: Uint8Array;
  truncatedTokenKeyId: number;
}

let cachedKey: RsaKeyMaterial | null = null;

function parseKeyMaterial(secretValue: string): Uint8Array {
  const pemMatch = secretValue.match(/-----BEGIN[^-]*-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END[^-]*-----/);
  if (pemMatch) {
    const b64 = pemMatch[1].replace(/\s/g, "");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
  return Uint8Array.from(atob(secretValue.trim()), (c) => c.charCodeAt(0));
}

export async function loadRsaKey(secretValue: string): Promise<RsaKeyMaterial> {
  if (cachedKey) return cachedKey;

  const keyBytes = parseKeyMaterial(secretValue);

  // Import as RSASSA-PKCS1-v1_5 to extract key material (algorithm doesn't matter for JWK export)
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"],
  );

  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const n = base64urlToBigInt(jwk.n!);
  const e = base64urlToBigInt(jwk.e!);
  const d = base64urlToBigInt(jwk.d!);

  const spki = buildRsaPssSpki(n, e);
  const tokenKeyId = await sha256(spki);
  const truncatedTokenKeyId = tokenKeyId[tokenKeyId.length - 1];

  cachedKey = { n, e, d, spki, tokenKeyId, truncatedTokenKeyId };
  return cachedKey;
}

// ─── Token request / response (binary, NOT protobuf) ────────────────────────

export const TOKEN_TYPE_BLIND_RSA = 0x0002;
export const BLIND_RSA_NK = 256;
export const TOKEN_REQUEST_SIZE = 2 + 1 + BLIND_RSA_NK;
export const TOKEN_SIZE = 2 + 32 + 32 + 32 + BLIND_RSA_NK;

export interface TokenRequest {
  tokenType: number;
  truncatedTokenKeyId: number;
  blindedMsg: Uint8Array;
}

export function parseTokenRequest(data: Uint8Array): TokenRequest {
  if (data.length !== TOKEN_REQUEST_SIZE) {
    throw new Error(`Invalid token request size: expected ${TOKEN_REQUEST_SIZE}, got ${data.length}`);
  }
  const tokenType = (data[0] << 8) | data[1];
  const truncatedTokenKeyId = data[2];
  const blindedMsg = data.slice(3, 3 + BLIND_RSA_NK);
  return { tokenType, truncatedTokenKeyId, blindedMsg };
}

export function blindSign(blindedMsg: Uint8Array, d: bigint, n: bigint): Uint8Array {
  if (blindedMsg.length !== BLIND_RSA_NK) {
    throw new Error(`Invalid blinded message size: expected ${BLIND_RSA_NK}, got ${blindedMsg.length}`);
  }
  const blinded = bytesToBigInt(blindedMsg);
  if (blinded >= n) throw new Error("Blinded message out of range");
  const blindSig = modPow(blinded, d, n);
  return bigIntToBytes(blindSig, BLIND_RSA_NK);
}

// ─── Token (for verification in Authorization header) ───────────────────────

export interface PrivacyPassToken {
  tokenType: number;
  nonce: Uint8Array;
  challengeDigest: Uint8Array;
  tokenKeyId: Uint8Array;
  authenticator: Uint8Array;
}

export function parseToken(data: Uint8Array): PrivacyPassToken {
  if (data.length !== TOKEN_SIZE) {
    throw new Error(`Invalid token size: expected ${TOKEN_SIZE}, got ${data.length}`);
  }
  const tokenType = (data[0] << 8) | data[1];
  const nonce = data.slice(2, 34);
  const challengeDigest = data.slice(34, 66);
  const tokenKeyId = data.slice(66, 98);
  const authenticator = data.slice(98, 98 + BLIND_RSA_NK);
  return { tokenType, nonce, challengeDigest, tokenKeyId, authenticator };
}

// Extract a Privacy Pass token from the Authorization header.
// Format: "PrivateToken token=<base64-encoded-token>"
export function extractPrivateToken(authHeader: string): PrivacyPassToken | null {
  if (!authHeader) return null;
  const match = authHeader.match(/PrivateToken\s+token=([A-Za-z0-9+/=_-]+)/i);
  if (!match) return null;
  const b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  try {
    return parseToken(bytes);
  } catch {
    return null;
  }
}

// Verify a Privacy Pass token using RSA-PSS (SHA-384, salt 48).
export async function verifyToken(
  token: PrivacyPassToken,
  n: bigint,
  e: bigint,
  expectedTokenKeyId: Uint8Array,
): Promise<boolean> {
  if (token.tokenType !== TOKEN_TYPE_BLIND_RSA) return false;
  if (!uint8ArrayEquals(token.tokenKeyId, expectedTokenKeyId)) return false;

  // token_authenticator_input = token_type || nonce || challenge_digest || token_key_id
  const input = new Uint8Array(2 + 32 + 32 + 32);
  input[0] = (token.tokenType >> 8) & 0xff;
  input[1] = token.tokenType & 0xff;
  input.set(token.nonce, 2);
  input.set(token.challengeDigest, 34);
  input.set(token.tokenKeyId, 66);

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: bigIntToBase64Url(n), e: bigIntToBase64Url(e), alg: "PS384" },
    { name: "RSA-PSS", hash: "SHA-384" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify({ name: "RSA-PSS", saltLength: 48 }, publicKey, token.authenticator, input);
}

function uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}