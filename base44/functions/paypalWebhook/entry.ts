import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") || "live";
const PAYPAL_API_BASE = PAYPAL_MODE === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID");

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

function extractUserId(event) {
  const resource = event.resource || {};
  return resource.custom_id || resource.subscriber?.custom_id || null;
}

async function processEvent(base44, event) {
  const userId = extractUserId(event);
  if (!userId) {
    console.log(`No user ID found in event ${event.id}`);
    return;
  }

  const eventType = event.event_type;
  console.log(`Processing event: ${eventType} for user: ${userId}`);

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "PAYMENT.SALE.COMPLETED":
      await base44.asServiceRole.entities.User.update(userId, {
        subscription_plan: "premium",
        subscription_status: "active",
        credits_used: 0,
        credits_reset_month: new Date().toISOString().slice(0, 7),
      });
      console.log(`User ${userId} upgraded to premium (event: ${eventType})`);
      break;

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
        subscription_plan: "free",
        subscription_status: "inactive",
      });
      console.log(`User ${userId} downgraded to free (event: ${eventType})`);
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