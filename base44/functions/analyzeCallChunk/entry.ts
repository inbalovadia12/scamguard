import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * TEST VERSION: Just transcribe with Deepgram, skip LLM.
 * Isolates whether the issue is Deepgram or the LLM agent call.
 */
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

    const body = await req.json();
    const { audio_url, audio_base64, audio_mime, language } = body;

    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramKey) {
      throw new Error('Deepgram API key not set');
    }

    let audioBlob: Blob;
    let contentType: string;

    if (audio_base64) {
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      contentType = audio_mime || 'audio/webm';
      audioBlob = new Blob([bytes], { type: contentType });
    } else if (audio_url) {
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) throw new Error('Could not fetch audio');
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    } else {
      throw new Error('No audio provided');
    }

    // Call Deepgram
    const deepgramResponse = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${language || 'en'}&punctuate=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': contentType,
        },
        body: audioBlob,
      }
    );

    if (!deepgramResponse.ok) {
      throw new Error(`Deepgram error ${deepgramResponse.status}`);
    }

    const data = await deepgramResponse.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    // Return JUST the transcript for now
    return Response.json({
      transcript: transcript,
      segments: [],
      red_flags: [],
      risk_level: 'low',
      is_scam: false,
      feedback: '',
      analysis: 'Transcript only (LLM skipped for testing)',
      confidence: 0.8,
    });

  } catch (error: any) {
    return Response.json({ 
      error: error?.message || 'Error',
      transcript: '',
    }, { status: 500 });
  }
});
