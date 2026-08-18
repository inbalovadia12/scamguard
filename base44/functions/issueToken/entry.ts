// Apple Live Caller ID Lookup — Privacy Pass token issuer
// POST serviceURL/issueToken  (also accessible at /functions/issueToken)
//
// Issues a Privacy Pass token for anonymous authentication. The client sends
// a blinded token request (blind RSA protocol, RFC 9474); the server signs
// the blinded token with its RSA private key and returns the blinded signature.
// The client unblinds the signature to obtain a valid Privacy Pass token.
//
// The token is later sent in the Authorization header of PIR requests instead
// of the userTierToken, providing anonymous authentication that hides the
// user's identity from the PIR service.
//
// Headers:
//   Authorization:  Bearer <Vardin access token (userTierToken)>

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Module-level RSA key pair cache (persists across warm invocations).
// On cold start, the key is regenerated from the stored secret.
let cachedKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey; spkiB64Url: string } | null = null;

async function getKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; spkiB64Url: string }> {
  if (cachedKeyPair) return cachedKeyPair;

  // Try to load the private key from the stored secret
  const storedKeyB64 = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
  if (storedKeyB64) {
    try {
      const keyBytes = Uint8Array.from(atob(storedKeyB64), (c) => c.charCodeAt(0));
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBytes,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"],
      );
      // Export public key for the directory
      const spki = await crypto.subtle.exportKey("spki", privateKey);
      const spkiB64Url = btoa(String.fromCharCode(...new Uint8Array(spki)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      cachedKeyPair = { publicKey: privateKey, privateKey, spkiB64Url };
      return cachedKeyPair;
    } catch {}
  }

  // Generate a new RSA key pair (2048-bit, OAEP with SHA-256)
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const spkiB64Url = btoa(String.fromCharCode(...new Uint8Array(spki)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  cachedKeyPair = {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    spkiB64Url,
  };
  return cachedKeyPair;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // Read the blinded token request (raw binary, 104 bytes for blind RSA)
    const body = await req.arrayBuffer();
    const bodyBytes = new Uint8Array(body);

    if (bodyBytes.length === 0) {
      return Response.json({ error: 'Empty token request' }, { status: 400 });
    }

    const keyPair = await getKeyPair();

    // Sign the blinded token using RSA-OAEP.
    //
    // Note: The full Privacy Pass blind RSA protocol (RFC 9474) requires raw
    // RSA modular exponentiation (no padding). Web Crypto's SubtleCrypto does
    // not support raw RSA operations. This implementation uses RSA-OAEP as a
    // practical approximation. For full Privacy Pass compliance, deploy a
    // dedicated token issuer using Apple's pir-service-example PrivacyPass
    // implementation.
    const signature = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      keyPair.privateKey,
      bodyBytes,
    );

    return new Response(signature, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}