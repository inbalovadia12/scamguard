import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { computeFamilyTotal, FAMILY_PRICING } from "../../shared/familyPricing.ts";
import { getPaypalAccessToken, PAYPAL_API } from "../../shared/paypalClient.ts";
import { buildReturnUrl } from "../../shared/appUrl.ts";

const PRODUCT_NAME = "Vardin Subscription";
const PRODUCT_DESC = "AI-powered scam detection and family protection";

const PLAN_CONFIGS: Record<string, { name: string; credits: string }> = {
  plus: { name: "Vardin Plus", credits: "150 credits/month" },
  premium: { name: "Vardin Premium", credits: "400 credits/month + all features" },
};

async function getOrCreateProduct(accessToken: string) {
  const listRes = await fetch(`${PAYPAL_API}/v1/catalogs/products?page_size=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.products || []).find((p: any) => p.name === PRODUCT_NAME);
    if (existing) return existing.id;
  }
  const createRes = await fetch(`${PAYPAL_API}/v1/catalogs/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: PRODUCT_NAME, description: PRODUCT_DESC, type: "SERVICE", category: "SOFTWARE" }),
  });
  if (!createRes.ok) throw new Error(`Product creation failed: ${createRes.status}`);
  const product = await createRes.json();
  return product.id;
}

async function getOrCreatePlan(accessToken: string, productId: string, planKey: string) {
  const config = PLAN_CONFIGS[planKey];
  if (!config) throw new Error(`Unknown plan: ${planKey}`);
  const listRes = await fetch(`${PAYPAL_API}/v1/billing/plans?page_size=20&product_id=${productId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.plans || []).find((p: any) => p.name === config.name);
    if (existing) return existing.id;
  }
  const createRes = await fetch(`${PAYPAL_API}/v1/billing/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      name: config.name,
      description: config.credits,
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: "YEAR", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: FAMILY_PRICING.plans[planKey].baseAnnual.toFixed(2), currency_code: "USD" } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    }),
  });
  if (!createRes.ok) throw new Error(`Plan creation failed: ${createRes.status}`);
  const plan = await createRes.json();
  return plan.id;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const planKey = body.plan;
    if (!PLAN_CONFIGS[planKey]) return Response.json({ error: `Invalid plan: ${planKey}` }, { status: 400 });

    // Server-authoritative member count + price. Never trust client values.
    const planDef = FAMILY_PRICING.plans[planKey];
    const requestedMembers = Math.max(1, Math.min(parseInt(body.members, 10) || planDef.includedMembers, planDef.maxMembers));
    const { members, totalAnnual } = computeFamilyTotal(planKey, requestedMembers);
    const totalAnnualStr = totalAnnual.toFixed(2);

    const origin = req.headers.get("origin") || null;
    const returnUrl = buildReturnUrl(origin, "/pricing?paypal=approved");
    const cancelUrl = buildReturnUrl(origin, "/pricing?paypal=cancelled");

    const accessToken = await getPaypalAccessToken();
    const productId = await getOrCreateProduct(accessToken);
    const planId = await getOrCreatePlan(accessToken, productId, planKey);

    const subRes = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: `${user.id}::${members}`,
        plan: {
          billing_cycles: [{
            frequency: { interval_unit: "YEAR", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: totalAnnualStr, currency_code: "USD" } },
          }],
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
      throw new Error(`Subscription creation failed: ${subRes.status}`);
    }

    const subscription = await subRes.json();
    const approvalLink = (subscription.links || []).find((l: any) => l.rel === "approve" || l.rel === "payer-action");
    if (!approvalLink) throw new Error("No approval link in PayPal response");

    // Persist the subscription id on the authenticated user immediately so
    // cancellation/reactivation can find it even before the webhook fires.
    // The webhook later confirms activation and grants entitlement.
    try {
      await base44.auth.updateMe({
        paypal_subscription_id: subscription.id,
        pending_subscription_plan: planKey,
        pending_family_members: members,
      });
    } catch { /* best-effort; webhook will still persist */ }

    return Response.json({
      approval_url: approvalLink.href,
      subscription_id: subscription.id,
      plan: planKey,
      members,
      total_annual: totalAnnualStr,
    });
  } catch (error: any) {
    console.error("createPaypalSubscription error:", error.message);
    return Response.json({ error: "Subscription setup failed" }, { status: 500 });
  }
});