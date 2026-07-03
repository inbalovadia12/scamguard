import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PAYPAL_API_BASE = "https://api-m.paypal.com";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");

const PRODUCT_NAME = "ScamGuard Subscription";
const PRODUCT_DESC = "AI-powered scam detection and family protection";

const PLAN_CONFIGS = {
  plus: { name: "ScamGuard Plus", price: "40.00", credits: "100 credits/month" },
  premium: { name: "ScamGuard Premium", price: "80.00", credits: "100 credits/month + advanced features" },
  elite: { name: "ScamGuard Elite", price: "120.00", credits: "250 credits/month + all features" },
};

async function getAccessToken() {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PayPal token error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getOrCreateProduct(accessToken) {
  const listRes = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products?page_size=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.products || []).find((p) => p.name === PRODUCT_NAME);
    if (existing) return existing.id;
  }

  const createRes = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: PRODUCT_NAME,
      description: PRODUCT_DESC,
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Product creation failed: ${createRes.status} ${txt}`);
  }
  const product = await createRes.json();
  return product.id;
}

async function getOrCreatePlan(accessToken, productId, planKey) {
  const config = PLAN_CONFIGS[planKey];
  if (!config) throw new Error(`Unknown plan: ${planKey}`);

  const listRes = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/plans?page_size=20&product_id=${productId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.plans || []).find((p) => p.name === config.name);
    if (existing) return existing.id;
  }

  const createRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: productId,
      name: config.name,
      description: config.credits,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "YEAR", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: config.price, currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Plan creation failed: ${createRes.status} ${txt}`);
  }
  const plan = await createRes.json();
  return plan.id;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const planKey = body.plan;
    if (!PLAN_CONFIGS[planKey]) {
      return Response.json({ error: `Invalid plan: ${planKey}` }, { status: 400 });
    }

    const origin = req.headers.get("origin") || "https://verinta.base44.app";
    const returnUrl = `${origin}/pricing?paypal=approved`;
    const cancelUrl = `${origin}/pricing?paypal=cancelled`;

    const accessToken = await getAccessToken();
    const productId = await getOrCreateProduct(accessToken);
    const planId = await getOrCreatePlan(accessToken, productId, planKey);

    const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id,
        application_context: {
          brand_name: "ScamGuard",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!subRes.ok) {
      const txt = await subRes.text();
      throw new Error(`Subscription creation failed: ${subRes.status} ${txt}`);
    }

    const subscription = await subRes.json();

    const approvalLink = (subscription.links || []).find(
      (l) => l.rel === "approve" || l.rel === "payer-action"
    );

    if (!approvalLink) {
      throw new Error("No approval link in PayPal response");
    }

    return Response.json({
      approval_url: approvalLink.href,
      subscription_id: subscription.id,
    });
  } catch (error) {
    console.error("createPaypalSubscription error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});