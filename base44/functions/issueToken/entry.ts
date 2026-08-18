// Apple Live Caller ID Lookup — Privacy Pass token issuer (RFC 9574 blind RSA).
// POST /functions/issueToken
//
// Accepts a TokenRequest (binary, 259 bytes):
//   uint16_t token_type = 0x0002  (big-endian)
//   uint8_t  truncated_token_key_id
//   uint8_t  blinded_msg[256]
//
// Returns a TokenResponse (binary, 256 bytes):
//   uint8_t  blind_sig[256]  = blinded_msg^d mod n
//
// No Vardin user authentication — anonymous Apple relay/PIR flow.

import { secrets } from "base44:runtime";
import {
  loadRsaKey,
  parseTokenRequest,
  blindSign,
  TOKEN_TYPE_BLIND_RSA,
  BLIND_RSA_NK,
} from "../../shared/privacyPass.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    if (!secretValue) {
      return Response.json({ error: "Token issuer not configured" }, { status: 500 });
    }

    const keyMaterial = await loadRsaKey(secretValue);

    const body = new Uint8Array(await req.arrayBuffer());
    if (body.length === 0) {
      return Response.json({ error: "Empty request body" }, { status: 400 });
    }

    let tokenReq;
    try {
      tokenReq = parseTokenRequest(body);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    if (tokenReq.tokenType !== TOKEN_TYPE_BLIND_RSA) {
      return Response.json({ error: "Unsupported token type" }, { status: 400 });
    }

    if (tokenReq.truncatedTokenKeyId !== keyMaterial.truncatedTokenKeyId) {
      return Response.json({ error: "Invalid token key ID" }, { status: 400 });
    }

    if (tokenReq.blindedMsg.length !== BLIND_RSA_NK) {
      return Response.json({ error: "Invalid blinded message size" }, { status: 400 });
    }

    // Blind RSA signing: blind_sig = blinded_msg^d mod n
    const blindSig = blindSign(tokenReq.blindedMsg, keyMaterial.d, keyMaterial.n);

    return new Response(blindSig, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}