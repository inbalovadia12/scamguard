import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAvailableCredits, atomicCreditCharge, refundCreditCharge, getMonthlyCreditLimit } from '../../shared/credits.ts';

const CREDIT_COST = 1;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Auth required' }, { status: 401 });

    const { text, speaker, context, language } = await req.json();
    if (!text) return Response.json({ error: 'Text is required' }, { status: 400 });

    // Pre-authorize credits BEFORE the LLM call to prevent concurrent bypass.
    const authUser = await base44.asServiceRole.entities.User.get(user.id);
    const available = getAvailableCredits(authUser);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(authUser),
        credit_cost: CREDIT_COST,
      }, { status: 402 });
    }

    const charge = await atomicCreditCharge(base44, user.id, CREDIT_COST);
    if (!charge.ok) {
      return Response.json({ error: 'Credit balance changed. Please try again.' }, { status: 409 });
    }

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a scam prevention coach. Analyze this statement from a ${speaker || 'caller'} and return a short feedback string (max 120 chars).\n\nContext: ${context || 'live call'}\nText: "${text}"\n\nReturn JSON: {"feedback": "your feedback"}`,
        response_json_schema: {
          type: "object",
          properties: {
            feedback: { type: "string", description: "Short coaching feedback, max 120 chars" }
          },
          required: ["feedback"]
        },
        model: "gemini_3_flash",
      });

      const feedback = typeof result?.feedback === 'string' ? result.feedback.slice(0, 200) : '';
      return Response.json({ feedback, credits_used: CREDIT_COST, credits_remaining: charge.remaining, credits_limit: charge.limit });
    } catch (llmError) {
      // Refund on failure — the LLM call didn't succeed.
      try { await refundCreditCharge(base44, charge.ledger_id); } catch {}
      return Response.json({ error: 'Fast feedback is temporarily unavailable' }, { status: 502 });
    }
  } catch {
    return Response.json({ error: 'Fast feedback is temporarily unavailable' }, { status: 502 });
  }
});