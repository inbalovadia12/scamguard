import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PAYPAL_API_BASE = "https://api-m.paypal.com";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID");

// Permanent monthly credit bonus awarded to a referrer when their referral
// first activates a paid plan. Additive to the referrer's monthly credit limit.
const REFERRAL_BONUS_CREDITS = 30;

async function getPayPalAccessToken() {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get PayPal access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function verifyWebhookSignature(headers, body) {
  const accessToken = await getPayPalAccessToken();

  const verificationPayload = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: body,
  };

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verificationPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal verification request failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.verification_status === "SUCCESS";
}

function parseCustomId(event) {
  const resource = event.resource || {};
  const raw = resource.custom_id || resource.subscriber?.custom_id || "";
  if (!raw) return { userId: null, members: null };
  if (raw.includes("::")) {
    const [uid, m] = raw.split("::");
    const members = parseInt(m, 10);
    return { userId: uid, members: Number.isNaN(members) ? null : members };
  }
  return { userId: raw, members: null };
}

async function determinePlanKey(accessToken, event) {
  const resource = event.resource || {};
  const subId = resource.id || resource.billing_agreement_id || resource.subscription_id;

  if (!subId) return "premium";

  try {
    const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!subRes.ok) return "premium";
    const sub = await subRes.json();
    const planId = sub.plan_id;
    if (!planId) return "premium";

    const planRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans/${planId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!planRes.ok) return "premium";
    const plan = await planRes.json();
    const planName = plan.name || "";

    if (planName.includes("Premium")) return "premium";
    if (planName.includes("Plus")) return "plus";
    return "premium";
  } catch (e) {
    console.log("Error determining plan:", e.message);
    return "premium";
  }
}

async function processEvent(base44, event) {
  const { userId, members } = parseCustomId(event);
  if (!userId) {
    console.log(`No user ID found in event ${event.id}`);
    return;
  }

  const eventType = event.event_type;
  console.log(`Processing event: ${eventType} for user: ${userId}`);

  const accessToken = await getPayPalAccessToken();

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "PAYMENT.SALE.COMPLETED": {
      const planKey = await determinePlanKey(accessToken, event);
      const update = {
        subscription_plan: planKey,
        subscription_status: "active",
        credits_used: 0,
        credits_reset_month: new Date().toISOString().slice(0, 7),
      };
      // Only set the paid member count for subscriptions created under the new
      // family pricing model (custom_id encodes "userId::members"). Legacy
      // subscribers (plain "userId") keep their prior limit via the fallback.
      if (members != null) update.family_members_paid = members;
      await base44.asServiceRole.entities.User.update(userId, update);
      console.log(`User ${userId} upgraded to ${planKey} (event: ${eventType})`);

      // Referral credit bonus: when a referred user first activates a paid plan,
      // award the referrer a permanent monthly credit bonus (once per referral).
      if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" && (planKey === "plus" || planKey === "premium")) {
        try {
          const payer = await base44.asServiceRole.entities.User.get(userId);
          if (payer?.referred_by && !payer.referral_awarded) {
            const referrer = await base44.asServiceRole.entities.User.get(payer.referred_by);
            if (referrer && referrer.id !== userId) {
              const newBonus = (referrer.referral_bonus_credits || 0) + REFERRAL_BONUS_CREDITS;
              await base44.asServiceRole.entities.User.update(referrer.id, { referral_bonus_credits: newBonus });
              console.log(`Referral bonus awarded: ${referrer.id} +${REFERRAL_BONUS_CREDITS} (referral: ${userId})`);
            }
            await base44.asServiceRole.entities.User.update(userId, { referral_awarded: true });
          }
        } catch (e) {
          console.log("Referral award error:", e.message);
        }
      }

      // Family perk propagation: extend the paid plan to joined family members
      if (planKey === "plus" || planKey === "premium") {
        try {
          const seniors = await base44.asServiceRole.entities.ProtectedSenior.filter({ guardian_id: userId });
          for (const s of seniors) {
            if (s.senior_user_id) {
              try {
                const seniorUser = await base44.asServiceRole.entities.User.get(s.senior_user_id);
                const sp = seniorUser?.subscription_plan || "starter";
                // Only upgrade seniors still on starter — never override their own paid plan
                if (sp === "starter" || sp === "free") {
                  await base44.asServiceRole.entities.User.update(s.senior_user_id, { subscription_plan: planKey, subscription_status: "active" });
                }
              } catch {}
            }
            if (s.guardian_plan !== planKey) {
              try { await base44.asServiceRole.entities.ProtectedSenior.update(s.id, { guardian_plan: planKey }); } catch {}
            }
          }
        } catch (e) { console.log("Family perk propagation error:", e.message); }
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
      await base44.asServiceRole.entities.User.update(userId, {
        subscription_status: "canceled",
      });
      console.log(`User ${userId} subscription cancelled`);
      break;

    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "PAYMENT.SALE.DENIED":
      await base44.asServiceRole.entities.User.update(userId, {
        subscription_plan: "starter",
        subscription_status: "inactive",
        family_members_paid: 1,
      });
      // Revoke inherited perks from family members who were on the guardian's plan
      try {
        const seniors = await base44.asServiceRole.entities.ProtectedSenior.filter({ guardian_id: userId });
        for (const s of seniors) {
          if (s.guardian_plan && s.guardian_plan !== "starter" && s.senior_user_id) {
            try {
              const seniorUser = await base44.asServiceRole.entities.User.get(s.senior_user_id);
              if ((seniorUser?.subscription_plan) === s.guardian_plan) {
                await base44.asServiceRole.entities.User.update(s.senior_user_id, { subscription_plan: "starter", subscription_status: "inactive" });
              }
            } catch {}
          }
          try { await base44.asServiceRole.entities.ProtectedSenior.update(s.id, { guardian_plan: "starter" }); } catch {}
        }
      } catch (e) { console.log("Family perk revocation error:", e.message); }
      console.log(`User ${userId} downgraded to starter (event: ${eventType})`);
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Fail closed if PayPal credentials are not configured
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) {
      console.error("PayPal credentials not configured — webhook rejected");
      return new Response(null, { status: 200 });
    }

    // Require all PayPal signature headers before attempting verification
    const requiredHeaders = [
      "paypal-auth-algo",
      "paypal-cert-url",
      "paypal-transmission-id",
      "paypal-transmission-sig",
      "paypal-transmission-time",
    ];
    for (const header of requiredHeaders) {
      if (!req.headers.get(header)) {
        console.error(`Missing required PayPal header: ${header}`);
        return new Response(null, { status: 200 });
      }
    }

    const body = await req.json();

    const isVerified = await verifyWebhookSignature(req.headers, body);
    if (!isVerified) {
      console.error("Webhook signature verification failed");
      return new Response(null, { status: 200 });
    }

    const base44 = createClientFromRequest(req);
    await processEvent(base44, body);

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("PayPal webhook error:", error.message);
    return new Response(null, { status: 200 });
  }
});