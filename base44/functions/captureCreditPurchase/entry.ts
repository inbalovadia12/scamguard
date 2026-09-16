import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { getPaypalAccessToken, PAYPAL_API } from "../../shared/paypalClient.ts";

// Server-authoritative credit packs. Must match createCreditPurchase.
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
    const orderId = body.order_id;
    if (!orderId || typeof orderId !== "string") {
      return Response.json({ error: "Missing order_id" }, { status: 400 });
    }

    // Look up our pending purchase record for this order. This is the
    // idempotency anchor: a completed order can only grant credits once.
    let purchase: any = null;
    try {
      const existing = await base44.entities.CreditPurchase.filter({ paypal_order_id: orderId });
      if (Array.isArray(existing) && existing.length > 0) purchase = existing[0];
    } catch { /* fall through to PayPal verification */ }

    // Idempotency: already captured -> return the prior result without charging again.
    if (purchase && purchase.status === "captured") {
      return Response.json({
        success: true,
        already_captured: true,
        credits_added: purchase.credits_to_grant,
      });
    }

    // Ownership: the pending record (if present) must belong to this user.
    if (purchase && purchase.user_id && purchase.user_id !== user.id) {
      return Response.json({ error: "Order ownership mismatch" }, { status: 403 });
    }

    const accessToken = await getPaypalAccessToken();

    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!captureRes.ok) {
      // Mark our record failed so it isn't re-used.
      if (purchase) {
        try { await base44.entities.CreditPurchase.update(purchase.id, { status: "failed" }); } catch {}
      }
      return Response.json({ error: "Capture failed" }, { status: 502 });
    }

    const captureData = await captureRes.json();
    const purchaseUnit = captureData.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    if (!capture || capture.status !== "COMPLETED") {
      if (purchase) {
        try { await base44.entities.CreditPurchase.update(purchase.id, { status: "failed" }); } catch {}
      }
      return Response.json({ error: "Payment not completed" }, { status: 400 });
    }

    // Ownership via PayPal reference_id (never trust the client).
    if (purchaseUnit.reference_id !== user.id) {
      return Response.json({ error: "Order mismatch" }, { status: 403 });
    }

    // Server-authoritative pack + amount. Determine from the verified capture
    // amount and match against our pack table. Reject unknown amounts.
    const amount = capture.amount?.value;
    const currency = capture.amount?.currency_code || "USD";
    if (currency !== "USD") {
      return Response.json({ error: "Unexpected currency" }, { status: 400 });
    }
    const packKey = Object.keys(CREDIT_PACKS).find((k) => CREDIT_PACKS[k].price === amount);
    if (!packKey) {
      return Response.json({ error: "Unknown pack amount" }, { status: 400 });
    }

    // Cross-check with our pending record's expected amount when present.
    if (purchase && purchase.expected_amount && purchase.expected_amount !== amount) {
      return Response.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const creditsToAdd = CREDIT_PACKS[packKey].credits;

    // Grant credits by reducing credits_used (floor at 0), respecting monthly reset.
    const currentMonth = new Date().toISOString().slice(0, 7);
    let creditsUsed = user.credits_used || 0;
    if (user.credits_reset_month !== currentMonth) creditsUsed = 0;
    creditsUsed = Math.max(0, creditsUsed - creditsToAdd);

    await base44.auth.updateMe({
      credits_used: creditsUsed,
      credits_reset_month: currentMonth,
    });

    // Mark captured so a duplicate capture call is a no-op.
    if (purchase) {
      try {
        await base44.entities.CreditPurchase.update(purchase.id, {
          status: "captured",
          captured_at: new Date().toISOString(),
        });
      } catch {}
    }

    return Response.json({
      success: true,
      credits_added: creditsToAdd,
      credits_used: creditsUsed,
    });
  } catch (error: any) {
    console.error("captureCreditPurchase error:", error.message);
    return Response.json({ error: "Credit purchase failed" }, { status: 500 });
  }
});