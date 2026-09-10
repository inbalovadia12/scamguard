import { createClientFromRequest } from "@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || admin.role !== "admin") return Response.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    const amount = Number(body.amount);
    const note = String(body.note || "").trim().slice(0, 500);
    if (!userId) return Response.json({ error: "User ID is required" }, { status: 400 });
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1000000) {
      return Response.json({ error: "Amount must be a positive whole number up to 1,000,000" }, { status: 400 });
    }

    const target = await base44.asServiceRole.entities.User.get(userId);
    if (!target) return Response.json({ error: "User not found" }, { status: 404 });
    const currentBalance = Math.max(0, Number(target.admin_credit_balance) || 0);
    const newBalance = currentBalance + amount;
    await base44.asServiceRole.entities.User.update(userId, { admin_credit_balance: newBalance });
    await base44.asServiceRole.entities.CreditGrant.create({
      user_id: userId, amount, admin_id: admin.id, admin_email: admin.email || "",
      created_date: new Date().toISOString(), note,
    });
    return Response.json({ success: true, user_id: userId, credits_granted: amount, admin_credit_balance: newBalance });
  } catch (error) {
    console.error("grantAdminCredits error:", error);
    return Response.json({ error: error?.message || "Failed to grant credits" }, { status: 500 });
  }
});
