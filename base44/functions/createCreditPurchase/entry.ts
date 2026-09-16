import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { getPaypalAccessToken, PAYPAL_API } from "../../shared/paypalClient.ts";
import { buildReturnUrl } from "../../shared/appUrl.ts";

// Server-authoritative credit packs. The browser never tells the backend the
// price, currency, or credit quantity — these are the only accepted values.
const CREDIT_PACKS: Record<string, { credits: number; price: string; name: string }> = {
  small: { credits: 50, price: "5.00", name: "Vardin 50 Credits" },
  medium: { credits: 150, price: "12.00", name: "Vardin 150 Credits" },
  large: { credits: 300, price: "20.00", name: "Vardin 300 Credits" },
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const packKey = body.pack;
    if (!CREDIT_PACKS[packKey]) {
      return Response.json({ error: "Invalid pack" }, { status: 400 });
    }

    const pack = CREDIT_PACKS[packKey];
    const origin = req.headers.get("origin") || null;
    const returnUrl = buildReturnUrl(origin, "/pricing?credits=approved");
    const cancelUrl = buildReturnUrl(origin, "/pricing?credits=cancelled");

    const accessToken = await getPaypalAccessToken();

    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: user.id,
          description: pack.name,
          amount: { currency_code: "USD", value: pack.price },
        }],
        application_context: {
          brand_name: "Vardin",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!orderRes.ok) throw new Error(`Order creation failed: ${orderRes.status}`);
    const order = await orderRes.json();
    const approvalLink = (order.links || []).find((l: any) => l.rel === "approve");
    if (!approvalLink) throw new Error("No approval link in PayPal response");

    // Persist a pending purchase record so capture can enforce idempotency and
    // verify ownership + expected amount server-side.
    try {
      await base44.entities.CreditPurchase.create({
        user_id: user.id,
        paypal_order_id: order.id,
        pack: packKey,
        expected_amount: pack.price,
        currency: "USD",
        credits_to_grant: pack.credits,
        status: "pending",
      });
    } catch { /* best-effort; capture still verifies via PayPal + reference_id */ }

    return Response.json({
      approval_url: approvalLink.href,
      order_id: order.id,
      pack: packKey,
      price: pack.price,
      credits: pack.credits,
    });
  } catch (error: any) {
    console.error("createCreditPurchase error:", error.message);
    return Response.json({ error: "Order setup failed" }, { status: 500 });
  }
});