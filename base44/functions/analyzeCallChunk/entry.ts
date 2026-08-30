import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    // Get Deepgram key - using the EXACT secret name you have
    const deepgramKey = Deno.env.get('deepgram_text_to_speech');
    
    if (!deepgramKey) {
      console.error('deepgram_text_to_speech secret not found');
      return Response.json({ 
        error: 'Deepgram key not configured',
        tried_key: 'deepgram_text_to_speech'
      }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium') {
      return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    }

    const body = await req.json();
    const { audio_url, audio_base64, audio_mime, language } = body;

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
      throw new Error('No audio data provided');
    }

    // Call Deepgram for transcription
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
      const errText = await deepgramResponse.text();
      console.error('Deepgram error:', deepgramResponse.status, errText);
      throw new Error(`Deepgram failed: ${deepgramResponse.status}`);
    }

    const data = await deepgramResponse.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0.8;

    if (!transcript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'No speech detected',
        confidence: 0,
      });
    }

    // ===== NOW ANALYZE WITH BASE44 AGENT =====
    const prompt = `Analyze for scam activity:

TRANSCRIPT: "${transcript}"

Return JSON:
{
  "segments": [{"speaker": "scammer|victim|unknown", "text": "quote"}],
  "red_flags": [],
  "tactics_detected": [],
  "risk_level": "low|medium|high",
  "is_scam": false,
  "feedback": "",
  "analysis": "summary"
}`;

    let analysis: any = {
      segments: [{ speaker: 'unknown', text: transcript }],
      red_flags: [],
      tactics_detected: [],
      risk_level: 'low',
      is_scam: false,
      feedback: '',
      analysis: 'Awaiting analysis',
    };

    try {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      const text = typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        analysis = JSON.parse(match[0]);
      }
    } catch (llmErr) {
      console.error('LLM error:', llmErr);
      // Use default analysis above
    }

    return Response.json({
      transcript: transcript,
      segments: analysis.segments || [],
      speaker: analysis.segments?.[0]?.speaker || 'unknown',
      red_flags: analysis.red_flags || [],
      tactics_detected: analysis.tactics_detected || [],
      risk_level: analysis.risk_level || 'low',
      is_scam: analysis.is_scam ?? false,
      feedback: analysis.feedback || '',
      analysis: analysis.analysis || '',
      confidence: confidence,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('FATAL ERROR:', error?.message || String(error));
    return Response.json({ 
      error: error?.message || 'Unknown error',
      type: error?.constructor?.name,
    }, { status: 500 });
  }
});
