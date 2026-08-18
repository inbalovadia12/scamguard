// Apple Live Caller ID Lookup — Token issuer directory.
// GET /functions/tokenDirectory
//
// Returns the Privacy Pass token issuer directory JSON (RFC 9578):
//   {
//     "issuer-request-uri": "https://<host>/functions/issueToken",
//     "token-keys": [{ "token-type": 2, "token-key": "<base64url-SPKI>", "not-before": <timestamp> }]
//   }

import { secrets } from "base44:runtime";
import { loadRsaKey, toBase64Url } from "../../shared/privacyPass.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const secretValue = secrets.get("LIVE_CALLER_ID_TOKEN_ISSUER_KEY");
    if (!secretValue) {
      return Response.json({ error: "Token issuer not configured" }, { status: 500 });
    }

    const keyMaterial = await loadRsaKey(secretValue);
    const tokenKeyB64Url = toBase64Url(keyMaterial.spki);

    const host = new URL(req.url).origin;
    const directory = {
      "issuer-request-uri": `${host}/functions/issueToken`,
      "token-keys": [
        {
          "token-type": 2,
          "token-key": tokenKeyB64Url,
          "not-before": Math.floor(Date.now() / 1000),
        },
      ],
    };

    return Response.json(directory, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}