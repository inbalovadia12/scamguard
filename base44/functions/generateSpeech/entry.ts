import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam — deep male, good for scammer voices

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const { text, voice_id, language } = body;

    if (!text) return Response.json({ error: 'Text is required' }, { status: 400 });

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