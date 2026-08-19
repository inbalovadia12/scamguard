import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { computeFamilyTotal, FAMILY_PRICING } from "../../shared/familyPricing.ts";
import { getAccessToken, findApprovalLink, PAYPAL_API_BASE } from "../../shared/paypal.ts";

const PRODUCT_NAME = "Vardin Subscription";
const PRODUCT_DESC = "AI-powered scam detection and family protection";

const PLAN_CONFIGS = {
  plus: { name: "Vardin Plus", credits: "150 credits/month" },
  premium: { name: "Vardin Premium", credits: "400 credits/month + all features" },
};

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
            fixed_price: { value: FAMILY_PRICING.plans[planKey].baseAnnual.toFixed(2), currency_code: "USD" },
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

    const requestedMembers = Math.max(1, parseInt(body.members, 10) || FAMILY_PRICING.plans[planKey].includedMembers);
    const { members, totalAnnual } = computeFamilyTotal(planKey, requestedMembers);
    const totalAnnualStr = totalAnnual.toFixed(2);

    const origin = req.headers.get("origin") || "https://vardin.app";
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
        custom_id: `${user.id}::${members}`,
        plan: {
          billing_cycles: [
            {
              frequency: { interval_unit: "YEAR", interval_count: 1 },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: totalAnnualStr, currency_code: "USD" },
              },
            },
          ],
        },
        application_context: {
          brand_name: "Vardin",
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

    const approvalUrl = findApprovalLink(subscription);
    if (!approvalUrl) {
      throw new Error("No approval link in PayPal response");
    }

    return Response.json({
      approval_url: approvalUrl,
      subscription_id: subscription.id,
    });
  } catch (error) {
    console.error("createPaypalSubscription error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});