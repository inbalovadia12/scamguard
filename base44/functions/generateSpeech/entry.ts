import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam — deep male, good for scammer voices
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
    const { text, voice_id, language } = body;

    if (!text) return Response.json({ error: 'Text is required' }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: `Text exceeds the ${MAX_TEXT_LENGTH} character limit.` }, { status: 400 });
    }

    // Credit check — TTS uses the app owner's paid ElevenLabs quota.
    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
      }, { status: 402 });
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) return Response.json({ error: 'TTS service not configured' }, { status: 500 });

    const voiceId = voice_id || DEFAULT_VOICE_ID;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        language_code: language || undefined,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      return Response.json({ error: `Eleven Labs TTS failed: ${response.status} ${errText}` }, { status: 502 });
    }

    // Charge credits via service role (server-side authoritative write).
    const usage = applyCreditUsage(user, CREDIT_COST);
    if (usage) {
      try { await base44.asServiceRole.entities.User.update(user.id, usage); } catch {}
    }

    // Stream binary audio directly — no base64 conversion, minimal latency
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});