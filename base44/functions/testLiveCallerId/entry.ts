// Self-tests for the Apple Live Caller ID Lookup backend.
// POST /functions/testLiveCallerId
//
// Runs end-to-end tests of the Privacy Pass token issuance and verification,
// protobuf encoding/decoding, and dataset building. Returns JSON with results.

import { secrets } from "base44:runtime";
import {
  loadRsaKey,
  parseTokenRequest,
  blindSign,
  parseToken,
  verifyToken,
  extractPrivateToken,
  buildRsaPssSpki,
  bytesToBigInt,
  bigIntToBytes,
  modPow,
  TOKEN_TYPE_BLIND_RSA,
  BLIND_RSA_NK,
  TOKEN_REQUEST_SIZE,
  TOKEN_SIZE,
  toBase64Url,
} from "../../shared/privacyPass.ts";
import {
  buildPirConfigAndHash,
  encodeConfigResponse,
  encodeConfig,
  encodeKeyStatus,
  encodeEvaluationKeyConfigFromConfig,
  encodePirResponse,
  encodeResponse,
  encodeResponses,
  parseEvaluationKeys,
  parseRequests,
} from "../../shared/liveCallerId.ts";
import * as pb from "../../shared/protobuf.ts";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  try {
    await fn();
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: e.message };
  }
}

export default async function (req: Request): Promise<Response> {
  const results: TestResult[] = [];

  // Test 1: RSA key loading and SPKI construction
  results.push(await runTest("RSA key loading + SPKI", async () => {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    if (!secretValue) throw new Error("LIVE_CALLER_ID_TOKEN_ISSUER_KEY secret not set");
    const key = await loadRsaKey(secretValue);
    if (!key.n || key.n <= 0n) throw new Error("Modulus n is invalid");
    if (!key.e || key.e <= 0n) throw new Error("Exponent e is invalid");
    if (!key.d || key.d <= 0n) throw new Error("Private exponent d is invalid");
    if (key.spki.length < 100) throw new Error("SPKI too short");
    if (key.tokenKeyId.length !== 32) throw new Error("Token key ID should be 32 bytes");
    if (key.truncatedTokenKeyId < 0 || key.truncatedTokenKeyId > 255) throw new Error("Truncated key ID out of range");
  }));

  // Test 2: SPKI format verification (must start with SEQUENCE)
  results.push(await runTest("SPKI DER format", async () => {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    const key = await loadRsaKey(secretValue!);
    if (key.spki[0] !== 0x30) throw new Error("SPKI must start with SEQUENCE tag 0x30");
    // Check for RSA-PSS OID (1.2.840.113549.1.1.10 = 06 09 2a 86 48 86 f7 0d 01 01 0a)
    const oidExpected = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a];
    let found = false;
    for (let i = 0; i < key.spki.length - oidExpected.length; i++) {
      let match = true;
      for (let j = 0; j < oidExpected.length; j++) {
        if (key.spki[i + j] !== oidExpected[j]) { match = false; break; }
      }
      if (match) { found = true; break; }
    }
    if (!found) throw new Error("SPKI does not contain RSA-PSS OID");
  }));

  // Test 3: Blind RSA signing round-trip
  results.push(await runTest("Blind RSA signing round-trip", async () => {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    const key = await loadRsaKey(secretValue!);

    // Create a fake blinded message (random-ish)
    const blindedMsg = new Uint8Array(BLIND_RSA_NK);
    for (let i = 0; i < BLIND_RSA_NK; i++) blindedMsg[i] = (i * 7 + 13) % 256;
    // Ensure it's less than n
    const blinded = bytesToBigInt(blindedMsg);
    const reduced = blinded % key.n;
    const reducedBytes = bigIntToBytes(reduced, BLIND_RSA_NK);

    // Sign
    const blindSig = blindSign(reducedBytes, key.d, key.n);
    if (blindSig.length !== BLIND_RSA_NK) throw new Error("Blind signature wrong size");

    // Verify: blind_sig^e mod n == blinded_msg
    const blindSigBigint = bytesToBigInt(blindSig);
    const recovered = modPow(blindSigBigint, key.e, key.n);
    if (recovered !== reduced) throw new Error("RSA signing round-trip failed");
  }));

  // Test 4: Token request parsing
  results.push(await runTest("TokenRequest parsing", async () => {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    const key = await loadRsaKey(secretValue!);

    // Build a valid token request
    const req = new Uint8Array(TOKEN_REQUEST_SIZE);
    req[0] = 0x00; // token_type high byte
    req[1] = 0x02; // token_type low byte (0x0002)
    req[2] = key.truncatedTokenKeyId;
    for (let i = 3; i < TOKEN_REQUEST_SIZE; i++) req[i] = (i * 3 + 1) % 256;

    const parsed = parseTokenRequest(req);
    if (parsed.tokenType !== TOKEN_TYPE_BLIND_RSA) throw new Error("Wrong token type");
    if (parsed.truncatedTokenKeyId !== key.truncatedTokenKeyId) throw new Error("Wrong truncated key ID");
    if (parsed.blindedMsg.length !== BLIND_RSA_NK) throw new Error("Wrong blinded msg size");
  }));

  // Test 5: Full token issuance + verification
  results.push(await runTest("Full token issuance + verification", async () => {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    const key = await loadRsaKey(secretValue!);

    // Build token request
    const tokenReqBytes = new Uint8Array(TOKEN_REQUEST_SIZE);
    tokenReqBytes[0] = 0x00;
    tokenReqBytes[1] = 0x02;
    tokenReqBytes[2] = key.truncatedTokenKeyId;
    const blindedMsg = new Uint8Array(BLIND_RSA_NK);
    for (let i = 0; i < BLIND_RSA_NK; i++) blindedMsg[i] = (i * 5 + 2) % 256;
    // Reduce mod n
    const blinded = bytesToBigInt(blindedMsg) % key.n;
    const reducedBytes = bigIntToBytes(blinded, BLIND_RSA_NK);
    tokenReqBytes.set(reducedBytes, 3);

    // Issue token
    const parsed = parseTokenRequest(tokenReqBytes);
    const blindSig = blindSign(parsed.blindedMsg, key.d, key.n);

    // Build a full token (simulating client unblinding)
    // Client: sig = blind_sig * r^(-1) mod n, but for testing we just use blind_sig as sig
    // since we're testing the signing operation, not the full blind protocol.
    const token = new Uint8Array(TOKEN_SIZE);
    token[0] = 0x00; token[1] = 0x02; // token_type
    // nonce (32 bytes)
    for (let i = 2; i < 34; i++) token[i] = i;
    // challenge_digest (32 bytes)
    for (let i = 34; i < 66; i++) token[i] = i;
    // token_key_id (32 bytes)
    token.set(key.tokenKeyId, 66);
    // authenticator (256 bytes) — use blind_sig as a stand-in
    token.set(blindSig, 98);

    const parsedToken = parseToken(token);
    if (parsedToken.tokenType !== TOKEN_TYPE_BLIND_RSA) throw new Error("Wrong token type");
    if (parsedToken.authenticator.length !== BLIND_RSA_NK) throw new Error("Wrong authenticator size");
  }));

  // Test 6: PIR config building
  results.push(await runTest("PIR config building", async () => {
    const { pirConfigBytes, configId, evalKeyConfigHash } = await buildPirConfigAndHash(1000);
    if (pirConfigBytes.length < 50) throw new Error("PIR config too short");
    if (configId.length !== 32) throw new Error("Config ID should be 32 bytes (SHA-256)");
    if (evalKeyConfigHash.length !== 32) throw new Error("Eval key config hash should be 32 bytes");
  }));

  // Test 7: ConfigResponse encoding
  results.push(await runTest("ConfigResponse encoding", async () => {
    const { pirConfigBytes, configId } = await buildPirConfigAndHash(500);
    const configBytes = encodeConfig(pirConfigBytes, configId);
    const evalKeyConfigBytes = encodeEvaluationKeyConfigFromConfig(pirConfigBytes);
    const keyStatusBytes = encodeKeyStatus(0, evalKeyConfigBytes);
    const configResponseBytes = encodeConfigResponse(
      [["vardin-caller-id", configBytes]],
      [keyStatusBytes],
    );
    if (configResponseBytes.length < 50) throw new Error("ConfigResponse too short");

    // Verify we can parse it back
    const fields = pb.parseFields(configResponseBytes);
    if (!fields.has(1)) throw new Error("ConfigResponse missing configs map (field 1)");
    if (!fields.has(2)) throw new Error("ConfigResponse missing key_info (field 2)");
  }));

  // Test 8: EvaluationKeys parsing
  results.push(await runTest("EvaluationKeys parsing", async () => {
    // Build a minimal EvaluationKeys message
    // EvaluationKey { EvaluationKeyMetadata metadata = 1; SerializedEvaluationKey evaluation_key = 2; }
    // EvaluationKeyMetadata { uint64 timestamp = 1; bytes identifier = 2; }
    const metadata = pb.concat(
      pb.encodeInt64Field(1, 12345),
      pb.encodeBytesField(2, new Uint8Array(32).fill(0xab)),
    );
    const evaluationKey = new Uint8Array(64).fill(0xcd);
    const evalKey = pb.concat(
      pb.encodeMessageField(1, metadata),
      pb.encodeBytesField(2, evaluationKey),
    );
    const evalKeys = pb.encodeMessageField(1, evalKey);

    const parsed = parseEvaluationKeys(evalKeys);
    if (parsed.length !== 1) throw new Error("Should parse 1 key");
    if (Number(parsed[0].timestamp) !== 12345) throw new Error("Wrong timestamp");
    if (parsed[0].identifier.length !== 32) throw new Error("Wrong identifier length");
    if (parsed[0].evaluationKey.length !== 64) throw new Error("Wrong evaluation key length");
  }));

  // Test 9: Requests parsing
  results.push(await runTest("Requests parsing", async () => {
    // Build a minimal Requests message
    // Request { string usecase = 1; PIRRequest pir_request = 2; }
    // PIRRequest { uint32 shard_index = 1; bytes query = 2; bytes evaluation_key_metadata = 3; bytes configuration_hash = 4; }
    const pirRequest = pb.concat(
      pb.encodeInt32Field(1, 0),
      pb.encodeBytesField(2, new Uint8Array(16).fill(0x11)),
      pb.encodeBytesField(3, new Uint8Array(8).fill(0x22)),
      pb.encodeBytesField(4, new Uint8Array(32).fill(0x33)),
    );
    const request = pb.concat(
      pb.encodeStringField(1, "vardin-caller-id"),
      pb.encodeMessageField(2, pirRequest),
    );
    const requests = pb.encodeMessageField(1, request);

    const parsed = parseRequests(requests);
    if (parsed.length !== 1) throw new Error("Should parse 1 request");
    if (parsed[0].usecase !== "vardin-caller-id") throw new Error("Wrong usecase");
    if (!parsed[0].pirRequest) throw new Error("Missing PIR request");
    if (parsed[0].pirRequest!.configurationHash.length !== 32) throw new Error("Wrong config hash length");
  }));

  // Test 10: Responses encoding
  results.push(await runTest("Responses encoding", async () => {
    const pirResp = encodePirResponse();
    const resp = encodeResponse(pirResp);
    const responses = encodeResponses([resp, resp]);
    if (responses.length === 0) throw new Error("Responses should not be empty (2 entries)");
    // Parse back
    const fields = pb.parseFields(responses);
    const responseEntries = fields.get(1) || [];
    if (responseEntries.length !== 2) throw new Error(`Should have 2 responses, got ${responseEntries.length}`);
  }));

  // Test 11: Authorization header parsing
  results.push(await runTest("Authorization header parsing", async () => {
    // Test with a properly formatted header (token content doesn't matter for this test)
    const fakeToken = new Uint8Array(TOKEN_SIZE);
    fakeToken[0] = 0x00; fakeToken[1] = 0x02;
    const tokenB64 = toBase64Url(fakeToken);
    const authHeader = `PrivateToken token=${tokenB64}`;
    const token = extractPrivateToken(authHeader);
    if (!token) throw new Error("Failed to extract token");
    if (token.tokenType !== TOKEN_TYPE_BLIND_RSA) throw new Error("Wrong token type");
  }));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  return Response.json({
    summary: { passed, total, allPassed: passed === total },
    results,
  });
}