import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard: Analyzes audio chunks from live calls for scam tactics.
 * 1. Deepgram: Transcribes audio (handles blurry phone quality)
 * 2. Base44 Agent: Detects scam patterns in real-time
 * 3. Returns: speaker, red flags, risk level, coaching feedback
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
    const { audio_url, audio_base64, audio_mime, language, session_context } = body;

    // ===== STEP 1: TRANSCRIBE WITH DEEPGRAM =====
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramKey) {
      return Response.json({ error: 'Deepgram not configured' }, { status: 500 });
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
      if (!audioResponse.ok) {
        return Response.json({ error: 'Failed to fetch audio' }, { status: 400 });
      }
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    } else {
      return Response.json({ error: 'Audio required' }, { status: 400 });
    }

    // Deepgram STT
    const deepgramResponse = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${language || 'en'}&punctuate=true&utterances=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': contentType,
        },
        body: audioBlob,
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!deepgramResponse.ok) {
      const errText = await deepgramResponse.text().catch(() => 'error');
      console.error('Deepgram failed:', deepgramResponse.status, errText);
      return Response.json({ error: 'STT failed' }, { status: 502 });
    }

    const deepgramData = await deepgramResponse.json();
    const transcript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0.8;

    if (!transcript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'No speech detected',
        warnings: ['No audio'],
        confidence: 0,
      });
    }

    // ===== STEP 2: ANALYZE WITH BASE44 AGENT =====
    const analysisPrompt = `You are a real-time scam detection expert. Analyze this call transcript for scam activity.

TRANSCRIPT: "${transcript}"

${session_context ? `CONTEXT: ${session_context}` : ''}

DETECT:
1. WHO IS SPEAKING (scammer vs victim)
   - Scammer: makes requests, creates urgency, threatens, impersonates
   - Victim: responds, asks questions, expresses doubt

2. RED FLAGS (if any present):
   - Urgency/time pressure
   - Money requests (gift cards, crypto, wire, prepaid)
   - Personal info (SSN, password, OTP, bank)
   - Impersonation (IRS, FBI, bank, tech, family)
   - Threats (arrest, account closure)
   - Too-good offers (prizes, refunds)
   - Remote access requests
   - Secrecy demands

3. SCAM TACTICS (name them)
4. RISK LEVEL (low/medium/high)
5. COACHING (if victim speaking)

RESPOND WITH VALID JSON ONLY:
{
  "segments": [{"speaker": "scammer|victim|unknown", "text": "exact quote"}],
  "red_flags": ["flag1"],
  "tactics_detected": ["tactic1"],
  "risk_level": "low",
  "is_scam": false,
  "feedback": "coaching if victim, else empty",
  "analysis": "1-2 sentence summary"
}`;

    let analysis: any = {};

    try {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        add_context_from_internet: false,
      });

      const responseText = typeof llmResponse === 'string' 
        ? llmResponse 
        : (llmResponse as any)?.response || '';

      // Extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('LLM error:', err);
      // Fallback below
    }

    // Ensure required fields
    if (!analysis.segments) {
      analysis = {
        segments: [{ speaker: 'unknown', text: transcript }],
        red_flags: [],
        tactics_detected: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'Analysis unavailable',
      };
    }

    // ===== STEP 3: RETURN RESPONSE =====
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
      warnings: confidence < 0.6 ? ['Poor audio quality - move closer to speaker'] : [],
      confidence: analysis.confidence ?? confidence,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('analyzeCallChunk error:', error?.message || error);
    return Response.json({ 
      error: error?.message || 'Analysis failed',
      transcript: '',
      segments: [],
      red_flags: [],
      risk_level: 'low',
      is_scam: false,
      confidence: 0,
    }, { status: 500 });
  }
});
