import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAvailableCredits, atomicCreditCharge, refundCreditCharge, getMonthlyCreditLimit } from '../../shared/credits.ts';

// Charges credits for an agent-chat message. The per-message cost is a
// server-authoritative constant — never read from the client request, so a
// caller cannot undercharge themselves. Reads and writes credit fields via
// the service role so the client-writable updateMe channel cannot reset or
// inflate the balance.
const AGENT_CHAT_COST = 2;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const cost = AGENT_CHAT_COST;

    // Read authoritative credit values via the service role to prevent
    // client-side reset attacks (updateMe writing credits_used: 0).
    const authUser = await base44.asServiceRole.entities.User.get(user.id);
    const available = getAvailableCredits(authUser);
    if (available.remaining < cost) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(authUser),
        credit_cost: cost,
      }, { status: 402 });
    }

    const charge = await atomicCreditCharge(base44, user.id, cost);
    if (!charge.ok) {
      return Response.json({ error: 'Credit balance changed. Please try again.' }, { status: 409 });
    }

    return Response.json({ success: true, credits_used: cost, credits_remaining: charge.remaining });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Credit charge failed' }, { status: 500 });
  }
});