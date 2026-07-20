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
    const orderId = body.order_id;
    if (!orderId) return Response.json({ error: "Missing order_id" }, { status: 400 });

    const accessToken = await getAccessToken();

    const captureRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!captureRes.ok) {
      const txt = await captureRes.text();
      throw new Error(`Capture failed: ${captureRes.status} ${txt}`);
    }

    const captureData = await captureRes.json();
    const purchaseUnit = captureData.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    if (!capture || capture.status !== "COMPLETED") {
      return Response.json({ error: "Payment not completed" }, { status: 400 });
    }

    // Verify the order belongs to this user
    if (purchaseUnit.reference_id !== user.id) {
      return Response.json({ error: "Order mismatch" }, { status: 403 });
    }

    // Determine pack from the amount paid
    const amount = capture.amount?.value;
    const packKey = Object.keys(CREDIT_PACKS).find((k) => CREDIT_PACKS[k].price === amount);
    if (!packKey) {
      return Response.json({ error: "Unknown pack amount" }, { status: 400 });
    }

    const creditsToAdd = CREDIT_PACKS[packKey].credits;

    // Add credits by reducing credits_used (floor at 0)
    const currentMonth = new Date().toISOString().slice(0, 7);
    let creditsUsed = user.credits_used || 0;
    if (user.credits_reset_month !== currentMonth) creditsUsed = 0;
    creditsUsed = Math.max(0, creditsUsed - creditsToAdd);

    await base44.auth.updateMe({
      credits_used: creditsUsed,
      credits_reset_month: currentMonth,
    });

    return Response.json({
      success: true,
      credits_added: creditsToAdd,
      credits_used: creditsUsed,
    });
  } catch (error) {
    console.error("captureCreditPurchase error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});