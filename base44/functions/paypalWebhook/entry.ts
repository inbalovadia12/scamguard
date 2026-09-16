import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getPaypalAccessToken, getPaypalWebhookId, PAYPAL_API } from "../../shared/paypalClient.ts";

// Permanent monthly credit bonus awarded to a referrer when their referral
// first activates a paid plan. Additive to the referrer's monthly credit limit.
const REFERRAL_BONUS_CREDITS = 30;

async function verifyWebhookSignature(headers: Headers, body: any): Promise<boolean> {
  const accessToken = await getPaypalAccessToken();
  const webhookId = getPaypalWebhookId();
  if (!webhookId) return false;

  const verificationPayload = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: body,
  };

  const response = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(verificationPayload),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.verification_status === "SUCCESS";
}

function parseCustomId(event: any) {
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

async function determinePlanKey(accessToken: string, event: any): Promise<string> {
  const resource = event.resource || {};
  const subId = resource.id || resource.billing_agreement_id || resource.subscription_id;
  if (!subId) return "premium";
  try {
    const subRes = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!subRes.ok) return "premium";
    const sub = await subRes.json();
    const planId = sub.plan_id;
    if (!planId) return "premium";
    const planRes = await fetch(`${PAYPAL_API}/v1/billing/plans/${planId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!planRes.ok) return "premium";
    const plan = await planRes.json();
    const planName = plan.name || "";
    if (planName.includes("Premium")) return "premium";
    if (planName.includes("Plus")) return "plus";
    return "premium";
  } catch {
    return "premium";
  }
}

async function isEventProcessed(base44: any, eventId: string): Promise<boolean> {
  try {
    const existing = await base44.asServiceRole.entities.ProcessedPaypalEvent.filter({ event_id: eventId });
    return Array.isArray(existing) && existing.length > 0;
  } catch {
    return false;
  }
}

async function markEventProcessed(base44: any, eventId: string, eventType: string, resourceId: string) {
  try {
    await base44.asServiceRole.entities.ProcessedPaypalEvent.create({
      event_id: eventId,
      event_type: eventType,
      resource_id: resourceId || "",
      processed_at: new Date().toISOString(),
    });
  } catch { /* best-effort; dedup is best-effort */ }
}

async function processEvent(base44: any, event: any) {
  const { userId, members } = parseCustomId(event);
  if (!userId) return;

  const eventType = event.event_type;
  const accessToken = await getPaypalAccessToken();
  const resourceId = event.resource?.id || event.resource?.subscription_id || "";

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "PAYMENT.SALE.COMPLETED": {
      const planKey = await determinePlanKey(accessToken, event);
      const update: any = {
        subscription_plan: planKey,
        subscription_status: "active",
        credits_used: 0,
        credits_reset_month: new Date().toISOString().slice(0, 7),
      };
      // Persist the PayPal subscription id so managePaypalSubscription can act
      // on the real subscription the user owns.
      if (resourceId) update.paypal_subscription_id = resourceId;
      if (members != null) update.family_members_paid = members;
      await base44.asServiceRole.entities.User.update(userId, update);

      // Referral credit bonus (once per referral).
      if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" && (planKey === "plus" || planKey === "premium")) {
        try {
          const payer = await base44.asServiceRole.entities.User.get(userId);
          if (payer?.referred_by && !payer.referral_awarded) {
            const referrer = await base44.asServiceRole.entities.User.get(payer.referred_by);
            if (referrer && referrer.id !== userId) {
              const newBonus = (referrer.referral_bonus_credits || 0) + REFERRAL_BONUS_CREDITS;
              await base44.asServiceRole.entities.User.update(referrer.id, { referral_bonus_credits: newBonus });
              try {
                const existing = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: userId, status: "pending" });
                if (existing.length > 0) {
                  await base44.asServiceRole.entities.Referral.update(existing[0].id, { status: "awarded", bonus_credits: REFERRAL_BONUS_CREDITS, plan: planKey, awarded_date: new Date().toISOString() });
                } else {
                  await base44.asServiceRole.entities.Referral.create({ referrer_id: referrer.id, referred_user_id: userId, referred_email: payer.email || "", referred_name: payer.full_name || "", status: "awarded", bonus_credits: REFERRAL_BONUS_CREDITS, plan: planKey, awarded_date: new Date().toISOString() });
                }
              } catch { /* referral record best-effort */ }
            }
            await base44.asServiceRole.entities.User.update(userId, { referral_awarded: true });
          }
        } catch { /* referral award best-effort */ }
      }

      // Family perk propagation: extend paid plan to joined family members.
      if (planKey === "plus" || planKey === "premium") {
        try {
          const seniors = await base44.asServiceRole.entities.ProtectedSenior.filter({ guardian_id: userId });
          for (const s of seniors) {
            if (s.senior_user_id) {
              try {
                const seniorUser = await base44.asServiceRole.entities.User.get(s.senior_user_id);
                const sp = seniorUser?.subscription_plan || "starter";
                if (sp === "starter" || sp === "free") {
                  await base44.asServiceRole.entities.User.update(s.senior_user_id, { subscription_plan: planKey, subscription_status: "active" });
                }
              } catch {}
            }
            if (s.guardian_plan !== planKey) {
              try { await base44.asServiceRole.entities.ProtectedSenior.update(s.id, { guardian_plan: planKey }); } catch {}
            }
          }
        } catch {}
      }
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
      await base44.asServiceRole.entities.User.update(userId, { subscription_status: "canceled" });
      break;

    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "PAYMENT.SALE.DENIED":
      await base44.asServiceRole.entities.User.update(userId, {
        subscription_plan: "starter",
        subscription_status: "inactive",
        family_members_paid: 1,
      });
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
      } catch {}
      break;

    default:
      break;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response(null, { status: 405 });

    // Fail closed if PayPal credentials/webhook id are not configured.
    if (!getPaypalWebhookId()) {
      console.error("PayPal webhook id not configured — webhook rejected");
      return new Response(null, { status: 200 });
    }

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

    const eventId = body?.id;
    if (!eventId) {
      return new Response(null, { status: 200 });
    }

    const base44 = createClientFromRequest(req);

    // Idempotency: skip if we have already processed this event id.
    if (await isEventProcessed(base44, eventId)) {
      return new Response(null, { status: 200 });
    }

    await processEvent(base44, body);

    // Record the event AFTER processing so a crash mid-process still allows a
    // retry from PayPal to re-run. (At-least-once with side-effect guards.)
    await markEventProcessed(base44, eventId, body.event_type, body.resource?.id || "");

    return new Response(null, { status: 200 });
  } catch (error: any) {
    console.error("PayPal webhook error:", error.message);
    return new Response(null, { status: 200 });
  }
});