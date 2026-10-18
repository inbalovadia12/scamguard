import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAvailableCredits, atomicCreditCharge, refundCreditCharge, getMonthlyCreditLimit } from '../../shared/credits.ts';

const CREDIT_COST = 1;
const MAX_TEXT_LENGTH = 5000;

// Rate limiting: caps TTS requests per user per minute.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    if (!checkRateLimit(user.id)) {
      return Response.json({ error: 'Rate limit exceeded. Please try again shortly.' }, { status: 429 });
    }

    const body = await req.json();
    const { text, language } = body;

    if (!text) return Response.json({ error: 'Text is required' }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: `Text exceeds the ${MAX_TEXT_LENGTH} character limit.` }, { status: 400 });
    }

    // Pre-authorize credits BEFORE the TTS call to prevent concurrent bypass.
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
      // Use the built-in Core.GenerateSpeech integration (no external secret needed).
      const result = await base44.integrations.Core.GenerateSpeech({
        text,
        language_code: language || undefined,
      });

      const audioUrl = result?.url;
      if (!audioUrl) throw new Error('No audio URL returned');

      // Fetch the generated audio and stream it back as binary.
      const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
      if (!audioRes.ok) throw new Error(`Audio fetch failed: ${audioRes.status}`);

      return new Response(audioRes.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (ttsError) {
      // Refund on failure — the TTS call didn't succeed.
      try { await refundCreditCharge(base44, user.id, CREDIT_COST); } catch {}
      return Response.json({ error: 'Text-to-speech is temporarily unavailable' }, { status: 502 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});