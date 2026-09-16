import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getAvailableCredits } from '../../shared/credits.ts';

// Issues a short-lived AssemblyAI Streaming v3 token so the browser can open
// the realtime WebSocket without exposing the permanent API key. The token is
// tied to a single streaming session; a new one is minted on each Start.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Auth required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium') {
      return Response.json({ error: 'Premium required' }, { status: 403 });
    }

    const available = getAvailableCredits(user);
    if (available.remaining < 1) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
      }, { status: 402 });
    }

    const assemblyKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyKey) {
      return Response.json({ error: 'STT not configured' }, { status: 500 });
    }

    const url = new URL('https://streaming.assemblyai.com/v3/token');
    url.search = new URLSearchParams({ expires_in_seconds: '600' }).toString();
    const tokenRes = await fetch(url, {
      headers: { Authorization: assemblyKey },
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return Response.json(
        { error: `Streaming token failed: ${detail.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await tokenRes.json();
    if (!data.token) {
      return Response.json({ error: 'No token returned' }, { status: 502 });
    }

    return Response.json({ token: data.token });
  } catch (error: any) {
    console.error('createCallGuardStreamToken error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});