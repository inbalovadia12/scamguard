import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

const PAYPAL_API_BASE = "https://api-m.paypal.com";

async function getAccessToken() {
  const clientId = secrets.get("PAYPAL_CLIENT_ID");
  const clientSecret = secrets.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action; // "cancel" | "reactivate"
    if (action !== "cancel" && action !== "reactivate") {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const subscriptionId = user.subscription_id || user.paypal_subscription_id;
    let nextBilling = null;

    if (subscriptionId) {
      const accessToken = await getAccessToken();
      const endpoint = action === "reactivate" ? "activate" : "cancel";
      const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: action === "cancel" ? JSON.stringify({ reason: "User requested cancellation" }) : "{}",
      });
      // 422 = already in that state; 404 = unknown sub; both are acceptable here
      if (!res.ok && res.status !== 422 && res.status !== 404) {
        const txt = await res.text();
        return Response.json({ error: `PayPal ${action} failed: ${res.status} ${txt}` }, { status: 502 });
      }

      if (action === "cancel") {
        const detailsRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          nextBilling = details.billing_info?.next_billing_time || null;
        }
      }
    }

    try {
      if (action === "cancel") {
        await base44.auth.updateMe({
          cancel_at_period_end: true,
          cancellation_date: new Date().toISOString(),
          cancellation_renewal_date: nextBilling,
        });
      } else {
        await base44.auth.updateMe({
          cancel_at_period_end: false,
          cancellation_date: null,
          cancellation_renewal_date: null,
        });
      }
    } catch { /* profile update is best-effort */ }

    return Response.json({ success: true, action, next_billing: nextBilling });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}