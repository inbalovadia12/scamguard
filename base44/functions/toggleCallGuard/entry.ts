import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, findApprovalLink, PAYPAL_API_BASE } from "../../shared/paypal.ts";

const CALL_GUARD_PRICE = 3.00;
const CALL_GUARD_PRODUCT_NAME = "Vardin Call Guard";
const CALL_GUARD_PLAN_NAME = "Vardin Call Guard Monthly";

async function getOrCreateCallGuardProduct(accessToken: string): Promise<string> {
  const listRes = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products?page_size=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.products || []).find((p: any) => p.name === CALL_GUARD_PRODUCT_NAME);
    if (existing) return existing.id;
  }
  const createRes = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CALL_GUARD_PRODUCT_NAME,
      description: "AI voice agent call screening with post-call scam analysis",
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

async function getOrCreateCallGuardPlan(accessToken: string, productId: string): Promise<string> {
  const listRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans?page_size=20&product_id=${productId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.plans || []).find((p: any) => p.name === CALL_GUARD_PLAN_NAME);
    if (existing) return existing.id;
  }
  const createRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      name: CALL_GUARD_PLAN_NAME,
      description: "Call Guard add-on — $3/month",
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: CALL_GUARD_PRICE.toFixed(2), currency_code: "USD" } },
      }],
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

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action;

    if (action === "enable") {
      const phoneNumber = String(body.phone_number || '').trim();
      if (!phoneNumber) {
        return Response.json({ error: 'A phone number is required to enable Call Guard' }, { status: 400 });
      }

      if (user.call_guard_status === 'active') {
        return Response.json({ error: 'Call Guard is already active' }, { status: 400 });
      }

      const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');

      const accessToken = await getAccessToken();
      const productId = await getOrCreateCallGuardProduct(accessToken);
      const planId = await getOrCreateCallGuardPlan(accessToken, productId);

      const origin = req.headers.get("origin") || "https://vardin.app";
      const returnUrl = `${origin}/pricing?callguard=approved`;
      const cancelUrl = `${origin}/pricing?callguard=cancelled`;

      // Custom ID: cg::{userId}::{phone_number} — distinguishes Call Guard subs from plan subs
      const customId = `cg::${user.id}::${normalizedPhone}`;

      const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          custom_id: customId,
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
      if (!approvalUrl) throw new Error("No approval link in PayPal response");

      // Pre-record phone number + subscription ID; status set to 'active' by the webhook on activation
      await base44.auth.updateMe({
        call_guard_enabled: true,
        call_guard_status: 'none',
        call_guard_phone_number: normalizedPhone,
        call_guard_subscription_id: subscription.id,
      });

      return Response.json({ approval_url: approvalUrl, subscription_id: subscription.id });
    }

    if (action === "disable") {
      const subscriptionId = user.call_guard_subscription_id;
      if (subscriptionId) {
        const accessToken = await getAccessToken();
        const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "User requested cancellation" }),
        });
        if (!res.ok && res.status !== 422 && res.status !== 404) {
          const txt = await res.text();
          return Response.json({ error: `PayPal cancellation failed: ${res.status} ${txt}` }, { status: 502 });
        }
      }

      await base44.auth.updateMe({
        call_guard_enabled: false,
        call_guard_status: 'cancelled',
        call_guard_expires_at: new Date().toISOString(),
      });

      return Response.json({ success: true, action: "disabled" });
    }

    return Response.json({ error: 'Invalid action. Use "enable" or "disable".' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}