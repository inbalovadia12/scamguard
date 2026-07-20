import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const PAYPAL_API_BASE = "https://api-m.paypal.com";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");

const CREDIT_PACKS: Record<string, { credits: number; price: string; name: string }> = {
  small: { credits: 50, price: "5.00", name: "Vardin 50 Credits" },
  medium: { credits: 150, price: "12.00", name: "Vardin 150 Credits" },
  large: { credits: 300, price: "20.00", name: "Vardin 300 Credits" },
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

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const packKey = body.pack;
    if (!CREDIT_PACKS[packKey]) {
      return Response.json({ error: `Invalid pack: ${packKey}` }, { status: 400 });
    }

    const pack = CREDIT_PACKS[packKey];
    const origin = req.headers.get("origin") || "https://vardin.app";
    const returnUrl = `${origin}/pricing?credits=approved`;
    const cancelUrl = `${origin}/pricing?credits=cancelled`;

    const accessToken = await getAccessToken();

    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: user.id,
          description: pack.name,
          amount: {
            currency_code: "USD",
            value: pack.price,
          },
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

    if (!orderRes.ok) {
      const txt = await orderRes.text();
      throw new Error(`Order creation failed: ${orderRes.status} ${txt}`);
    }

    const order = await orderRes.json();
    const approvalLink = (order.links || []).find((l) => l.rel === "approve");
    if (!approvalLink) throw new Error("No approval link in PayPal response");

    return Response.json({
      approval_url: approvalLink.href,
      order_id: order.id,
    });
  } catch (error) {
    console.error("createCreditPurchase error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});