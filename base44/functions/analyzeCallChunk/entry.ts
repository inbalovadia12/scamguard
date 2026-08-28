import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Analyzes a chunk of audio from a live call for scam tactics.
 * 
 * OPTIMIZED FLOW:
 * 1. Deepgram: Transcribe audio → text (1-1.5s, handles blurry audio)
 * 2. Base44 Agent: Intelligent scam detection on transcript (1-2s, context-aware)
 * 3. Return analysis: speaker, red flags, risk level, coaching feedback
 * 
 * Uses Base44's built-in agent for real-time, context-aware analysis.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { audio_url, audio_base64, audio_mime, language, session_context, speaker_history } = body;

    // ========================================
    // STEP 1: SPEECH-TO-TEXT (Deepgram)
    // ========================================
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramKey) return Response.json({ error: 'Deepgram STT not configured' }, { status: 500 });

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
    } else {
      if (!audio_url) {
        return Response.json({ error: 'Audio data required' }, { status: 400 });
      }
      const audioResponse = await fetch(audio_url);
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    }

    // Deepgram: Fast transcription optimized for phone quality (blurry audio)
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
      const errText = await deepgramResponse.text().catch(() => 'unknown');
      console.error('Deepgram STT failed:', deepgramResponse.status, errText);
      return Response.json({ error: `STT service error: ${deepgramResponse.status}` }, { status: 502 });
    }

    const deepgramResult = await deepgramResponse.json();
    const transcript = deepgramResult.results?.channels[0]?.alternatives[0]?.transcript || '';
    const deepgramWords = deepgramResult.results?.channels[0]?.alternatives[0]?.words || [];
    const avgConfidence = deepgramResult.results?.channels[0]?.alternatives[0]?.confidence || 1;

    if (!transcript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        warnings: ['No speech detected. Speak louder or closer to microphone.'],
        tactics_detected: [],
        feedback: '',
        analysis: 'No audio detected.',
        is_scam: false,
      });
    }

    // Audio quality warning (Deepgram confidence)
    const audioQualityWarning = avgConfidence < 0.6
      ? '📢 Poor audio quality detected. Move closer to speaker for better transcription.'
      : '';

    // ========================================
    // STEP 2: SCAM ANALYSIS (Base44 Agent)
    // ========================================
    // Build context for agent with Vardin scam detection expertise
    const agentPrompt = `You are a real-time scam detection expert analyzing a live phone call.

CALL TRANSCRIPT:
${transcript}

${session_context ? `\nPREVIOUS CALL CONTEXT:\n${session_context}` : ''}

${speaker_history ? `\nSPEAKER PATTERN (who spoke recently, oldest→newest):\n${speaker_history}` : ''}

ANALYZE FOR:
1. WHO IS SPEAKING (scammer vs victim)
   - Scammer: makes requests, creates urgency, threatens, impersonates
   - Victim: responds to requests, asks questions, expresses doubt
   - Short replies ("yes", "okay", "I see") = likely victim
   
2. SCAM RED FLAGS (identify ANY present):
   - Urgency/time pressure ("act now", "limited time")
   - Money requests (gift cards, crypto, wire transfer, prepaid cards)
   - Personal info requests (SSN, passwords, OTP, bank account)
   - Impersonation (IRS, FBI, bank, tech support, family member, delivery)
   - Threats (arrest, account closure, legal action)
   - Too-good-to-be-true offers (prizes, refunds, jobs)
   - Remote access requests (TeamViewer, AnyDesk, screen share)
   - Secrecy demands ("don't tell anyone", "keep this private")

3. SCAM TACTICS DETECTED (name specific ones):
   - Authority impersonation
   - Urgency creation
   - Fear/threat escalation
   - Information gathering
   - Payment manipulation

4. COACHING FEEDBACK (if victim detected):
   - Specific advice on what to say
   - Red flags to watch for
   - How to end the call safely

RESPOND WITH VALID JSON (no markdown, no explanation):
{
  "segments": [
    { "speaker": "scammer|victim|unknown", "text": "exact quote from transcript" }
  ],
  "red_flags": ["specific flag found", "another flag"],
  "tactics_detected": ["tactic name", "another tactic"],
  "risk_level": "low|medium|high",
  "is_scam": true|false,
  "feedback": "coaching advice if victim speaking, else empty string",
  "analysis": "1-2 sentence summary of scam risk",
  "confidence": 0.0-1.0
}`;

    let analysis: any = {};

    try {
      // Use Base44's agent for intelligent, context-aware analysis
      const agentResponse = await base44.integrations.Core.InvokeLLM({
        prompt: agentPrompt,
        add_context_from_internet: false,
        model: 'gemini-2.0-flash',
      });

      // Parse agent response
      const responseText = typeof agentResponse === 'string' ? agentResponse : (agentResponse as any)?.response || JSON.stringify(agentResponse);
      
      // Extract JSON from response (agent might add explanation)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;

      try {
        analysis = JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn('Failed to parse agent response, using fallback:', parseError);
        analysis = {
          segments: [{ speaker: 'unknown', text: transcript }],
          red_flags: [],
          tactics_detected: [],
          risk_level: 'unknown',
          is_scam: false,
          feedback: '',
          analysis: 'Analysis incomplete.',
          confidence: 0.5,
        };
      }
    } catch (agentError) {
      console.error('Agent analysis failed:', agentError);
      analysis = {
        segments: [{ speaker: 'unknown', text: transcript }],
        red_flags: [],
        tactics_detected: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'Agent analysis unavailable.',
        confidence: 0,
      };
    }

    // ========================================
    // STEP 3: RETURN STRUCTURED ANALYSIS
    // ========================================
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
      warnings: [...(analysis.warnings || []), ...(audioQualityWarning ? [audioQualityWarning] : [])],
      confidence: analysis.confidence ?? avgConfidence,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('analyzeCallChunk error:', error);
    return Response.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
});
