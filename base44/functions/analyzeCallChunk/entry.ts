import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Analyzes a chunk of audio from a live call for scam tactics.
 * Uses Deepgram for STT + Base44 Agent for scam detection.
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

    console.log('analyzeCallChunk called with:', { audio_url: !!audio_url, audio_base64: !!audio_base64 });

    // ===== TRANSCRIBE WITH DEEPGRAM =====
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramKey) {
      console.error('DEEPGRAM_API_KEY not set');
      return Response.json({ error: 'Deepgram not configured' }, { status: 500 });
    }

    let audioBlob: Blob;
    let contentType: string;

    if (audio_base64) {
      console.log('Using base64 audio');
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      contentType = audio_mime || 'audio/webm';
      audioBlob = new Blob([bytes], { type: contentType });
    } else if (audio_url) {
      console.log('Fetching audio from URL:', audio_url);
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) {
        console.error('Failed to fetch audio:', audioResponse.status);
        return Response.json({ error: 'Failed to fetch audio' }, { status: 400 });
      }
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    } else {
      console.error('No audio data provided');
      return Response.json({ error: 'Audio data required' }, { status: 400 });
    }

    console.log('Audio blob size:', audioBlob.size, 'Type:', contentType);

    // Deepgram API call
    console.log('Calling Deepgram...');
    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-2&language=${language || 'en'}&punctuate=true&utterances=true`;
    
    const deepgramResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': contentType,
      },
      body: audioBlob,
      signal: AbortSignal.timeout(15000),
    });

    console.log('Deepgram response status:', deepgramResponse.status);

    if (!deepgramResponse.ok) {
      const errText = await deepgramResponse.text().catch(() => 'unknown');
      console.error('Deepgram error:', deepgramResponse.status, errText);
      return Response.json({ error: `Deepgram failed: ${deepgramResponse.status}` }, { status: 502 });
    }

    const deepgramData = await deepgramResponse.json();
    console.log('Deepgram success, channels:', deepgramData.results?.channels?.length);

    const transcript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0.8;

    console.log('Transcript length:', transcript.length, 'Confidence:', confidence);

    if (!transcript.trim()) {
      console.log('No transcript, returning empty analysis');
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'No speech detected',
        warnings: ['No audio detected'],
        confidence: 0,
      });
    }

    // ===== ANALYZE WITH BASE44 AGENT =====
    console.log('Calling Base44 agent...');

    const prompt = `Analyze this phone call for scam activity. Respond ONLY with valid JSON.

TRANSCRIPT: "${transcript}"

Detect:
1. Speaker type (scammer vs victim)
2. Red flags: urgency, money requests, info requests, impersonation, threats, offers, remote access, secrecy
3. Scam tactics
4. Risk level (low/medium/high)
5. Coaching feedback

Return JSON only:
{
  "segments": [{"speaker": "scammer|victim|unknown", "text": "quote"}],
  "red_flags": [],
  "tactics_detected": [],
  "risk_level": "low",
  "is_scam": false,
  "feedback": "",
  "analysis": "summary",
  "confidence": 0.5
}`;

    let analysis: any = {
      segments: [{ speaker: 'unknown', text: transcript }],
      red_flags: [],
      tactics_detected: [],
      risk_level: 'low',
      is_scam: false,
      feedback: '',
      analysis: 'Default fallback',
      confidence: 0.5,
    };

    try {
      console.log('Invoking LLM agent...');
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      console.log('LLM response type:', typeof llmResponse);

      const responseText = typeof llmResponse === 'string' 
        ? llmResponse 
        : (llmResponse as any)?.response || JSON.stringify(llmResponse);

      console.log('LLM response text length:', responseText.length);

      // Extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Parsed analysis successfully');
        analysis = parsed;
      } else {
        console.warn('No JSON found in response');
      }
    } catch (agentError) {
      console.error('Agent error:', agentError instanceof Error ? agentError.message : agentError);
      // Use default analysis above
    }

    console.log('Returning analysis...');

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
      warnings: confidence < 0.6 ? ['Poor audio quality'] : [],
      confidence: analysis.confidence ?? confidence,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const msg = error?.message || error?.toString?.() || 'Unknown error';
    console.error('FATAL analyzeCallChunk error:', msg);
    
    return Response.json({ 
      error: msg,
      transcript: '',
      segments: [],
      red_flags: [],
      risk_level: 'low',
      is_scam: false,
      confidence: 0,
    }, { status: 500 });
  }
});
