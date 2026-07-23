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

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return Response.json({ error: 'Eleven Labs TTS failed' }, { status: 502 });
    }

    const audioBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return Response.json({ audio_url: dataUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});