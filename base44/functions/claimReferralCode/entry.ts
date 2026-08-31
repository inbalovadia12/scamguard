import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";

function normalizeCode(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: "Auth required" }, { status: 401 });

    const { code: rawCode } = await req.json();
    const code = normalizeCode(rawCode);
    if (!code || code.length < 8) {
      return Response.json({ error: "Enter a valid referral code" }, { status: 400 });
    }

    const user = await base44.asServiceRole.entities.User.get(authUser.id);
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });
    if (user.referred_by) return Response.json({ status: "already_claimed" });

    const matches = await base44.asServiceRole.entities.User.filter({ referral_code: code });
    const referrer = matches[0];
    if (!referrer) return Response.json({ error: "That referral code was not found" }, { status: 404 });
    if (referrer.id === authUser.id) {
      return Response.json({ error: "You cannot use your own referral code" }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: authUser.id });
    if (existing.length > 0) return Response.json({ status: "already_claimed" });

    await base44.asServiceRole.entities.User.update(authUser.id, { referred_by: referrer.id });
    await base44.asServiceRole.entities.Referral.create({
      referrer_id: referrer.id,
      referred_user_id: authUser.id,
      referred_email: user.email || authUser.email || "",
      referred_name: user.full_name || authUser.full_name || "",
      status: "pending",
      bonus_credits: 0,
    });

    return Response.json({ status: "applied", referrer_name: referrer.full_name || "" });
  } catch (error) {
    console.error("claimReferralCode failed", error);
    return Response.json({ error: "Could not apply the referral code" }, { status: 500 });
  }
});