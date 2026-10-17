import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

// Charges credits for an agent-chat message. Reads and writes credit fields
// via the service role so the client-writable updateMe channel cannot reset
// or inflate the balance.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cost = Number(body?.cost) || 2;
    if (!Number.isInteger(cost) || cost <= 0) {
      return Response.json({ error: 'Invalid credit cost' }, { status: 400 });
    }

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

    const usage = applyCreditUsage(authUser, cost);
    if (!usage) {
      return Response.json({ error: 'Credit balance changed. Please try again.' }, { status: 409 });
    }
    await base44.asServiceRole.entities.User.update(user.id, usage);

    const remaining = getAvailableCredits({ ...authUser, ...usage }).remaining;
    return Response.json({ success: true, credits_used: cost, credits_remaining: remaining });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Credit charge failed' }, { status: 500 });
  }
});