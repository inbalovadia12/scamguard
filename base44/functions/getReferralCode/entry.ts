import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return "VARDIN" + Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: "Auth required" }, { status: 401 });

    const user = await base44.asServiceRole.entities.User.get(authUser.id);
    if (user?.referral_code) return Response.json({ code: user.referral_code });

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = createCode();
      const existing = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.User.update(authUser.id, { referral_code: code });
        return Response.json({ code });
      }
    }

    return Response.json({ error: "Could not generate a unique referral code" }, { status: 503 });
  } catch (error) {
    console.error("getReferralCode failed", error);
    return Response.json({ error: "Could not load your referral code" }, { status: 500 });
  }
});