import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPaypalAccessToken, PAYPAL_API } from "../../shared/paypalClient.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action; // "cancel" | "reactivate"
    if (action !== "cancel" && action !== "reactivate") {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Subscription id is read ONLY from trusted server-side user data. Never
    // accept a client-supplied subscription id.
    const subscriptionId = user.paypal_subscription_id || user.subscription_id;
    if (!subscriptionId) {
      return Response.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const accessToken = await getPaypalAccessToken();
    const endpoint = action === "reactivate" ? "activate" : "cancel";
    const res = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: action === "cancel" ? JSON.stringify({ reason: "User requested cancellation" }) : "{}",
    });

    // 422 = already in that state; 404 = unknown sub. Both are acceptable.
    let nextBilling = null;
    if (!res.ok && res.status !== 422 && res.status !== 404) {
      return Response.json({ error: `PayPal ${action} failed` }, { status: 502 });
    }

    // Fetch current status from PayPal to synchronize local state.
    const detailsRes = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let paypalStatus: string | null = null;
    if (detailsRes.ok) {
      const details = await detailsRes.json();
      paypalStatus = details.status || null;
      nextBilling = details.billing_info?.next_billing_time || null;
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

    return Response.json({
      success: true,
      action,
      next_billing: nextBilling,
      paypal_status: paypalStatus,
    });
  } catch (error: any) {
    return Response.json({ error: "Subscription update failed" }, { status: 500 });
  }
});