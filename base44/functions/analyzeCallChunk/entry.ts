import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Analyzes a chunk of audio from a live call for scam tactics.
 * 
 * FLOW:
 * 1. Deepgram: Transcribe audio (handles blurry phone quality)
 * 2. Base44 Agent: Real-time scam detection on transcript
 * 3. Return: speaker, red flags, risk level, coaching
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
    const { audio_url, audio_base64, audio_mime, language, session_context, speaker_history } = body;

    // ========== STEP 1: TRANSCRIBE WITH DEEPGRAM ==========
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramKey) return Response.json({ error: 'Deepgram not configured' }, { status: 500 });

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
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    } else {
      return Response.json({ error: 'Audio data required' }, { status: 400 });
    }

    // Call Deepgram STT
    const deepgramResponse = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${language || 'en'}&punctuate=true&utterances=true&speaker_labels=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': contentType,
        },
        body: audioBlob,
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!deepgramResponse.ok) {
      const errText = await deepgramResponse.text().catch(() => 'error');
      console.error('Deepgram failed:', deepgramResponse.status, errText);
      return Response.json({ error: 'STT failed' }, { status: 502 });
    }

    const deepgramData = await deepgramResponse.json();
    const transcript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.confidence || 1;

    if (!transcript.trim()) {
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

    // ========== STEP 2: ANALYZE WITH BASE44 AGENT ==========
    const analysisPrompt = `Analyze this call for scam activity:

TRANSCRIPT: ${transcript}

${session_context ? `CONTEXT: ${session_context}` : ''}
${speaker_history ? `HISTORY: ${speaker_history}` : ''}

WHO IS SPEAKING:
- Scammer: requests money/info, creates urgency, threatens, impersonates
- Victim: responds, shares info, asks questions

RED FLAGS:
- Urgency/time pressure
- Money requests (gift cards, crypto, wire, prepaid)
- Personal info (SSN, password, OTP, bank)
- Impersonation (IRS, FBI, bank, tech, family)
- Threats (arrest, account closure)
- Too-good offers
- Remote access requests
- Secrecy demands

RETURN JSON:
{
  "segments": [{"speaker": "scammer|victim|unknown", "text": "quote"}],
  "red_flags": ["flag1", "flag2"],
  "tactics_detected": ["tactic1"],
  "risk_level": "low|medium|high",
  "is_scam": true|false,
  "feedback": "coaching if victim, else empty",
  "analysis": "1-2 sentence summary",
  "confidence": 0.0-1.0
}`;

    let analysis: any = {};

    try {
      // Call Base44 LLM agent
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        add_context_from_internet: false,
      });

      const responseText = typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || '';
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn('JSON parse failed');
        }
      }
    } catch (agentError) {
      console.error('LLM agent error:', agentError);
    }

    // Ensure analysis has required fields
    if (!analysis.segments) {
      analysis = {
        segments: [{ speaker: 'unknown', text: transcript }],
        red_flags: [],
        tactics_detected: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'Analysis unavailable',
        confidence: 0.5,
      };
    }

    // Return structured response
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
    console.error('analyzeCallChunk error:', error?.message || error);
    return Response.json({ 
      error: error?.message || 'Analysis failed',
      transcript: '',
      segments: [],
      red_flags: [],
      risk_level: 'low',
      is_scam: false,
      feedback: '',
      analysis: 'Error during analysis',
      confidence: 0,
    }, { status: 500 });
  }
});
