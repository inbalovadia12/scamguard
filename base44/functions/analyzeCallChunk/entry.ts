import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard - Real-time call analysis with speaker detection
 *
 * FLOW:
 * 1. Groq Whisper → transcript + segments (with timestamps)
 * 2. Groq LLM → classify each segment: "you" vs "caller" vs "unknown"
 * 3. Keyword fast-path → detect scam indicators
 * 4. Groq LLM → scam analysis (only if ambiguous)
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
    const {
      audio_url,
      audio_base64,
      audio_mime,
      language,
      session_context = '',
      speaker_history = '',
    } = body;

    const groqKey = Deno.env.get('GROQ_STT');
    if (!groqKey) {
      return Response.json({ error: 'Groq STT not configured' }, { status: 500 });
    }

    const startTime = Date.now();
    const languageCode = language === 'he' ? 'he' : language === 'es' ? 'es' : 'en';

    // ===== STEP 1: TRANSCRIBE WITH GROQ WHISPER =====
    const form = new FormData();
    form.set('model', 'whisper-large-v3-turbo');
    form.set('language', languageCode);
    form.set('response_format', 'verbose_json');
    form.set('timestamp_granularities[]', 'segment');

    if (audio_url) {
      form.set('url', audio_url);
    } else if (audio_base64) {
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mimeType = audio_mime || 'audio/webm';
      const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm';
      form.set('file', new File([bytes], `call.${ext}`, { type: mimeType }));
    } else {
      throw new Error('No audio data provided');
    }

    const transcriptResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
      signal: AbortSignal.timeout(8000),
    });

    if (!transcriptResponse.ok) {
      const detail = await transcriptResponse.text().catch(() => '');
      throw new Error(`Groq transcription failed: ${transcriptResponse.status} ${detail.slice(0, 200)}`);
    }

    const transcriptData = await transcriptResponse.json();

    // ===== STEP 2: EXTRACT CLEAN SEGMENTS =====
    const groqSegments: any[] = Array.isArray(transcriptData.segments) ? transcriptData.segments : [];

    // Filter out silence/hallucinated segments
    const speechSegments = groqSegments.filter((seg: any) => {
      const noSpeech = typeof seg?.no_speech_prob === 'number' ? seg.no_speech_prob : 0;
      const lowConf = typeof seg?.avg_logprob === 'number' && seg.avg_logprob < -1.5;
      return seg?.text?.trim() && noSpeech < 0.55 && !lowConf;
    });

    const fullTranscript = speechSegments.length > 0
      ? speechSegments.map((s: any) => s.text.trim()).join(' ')
      : (transcriptData.text || '').trim();

    if (!fullTranscript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'No speech detected',
        confidence: 0,
        timing_ms: Date.now() - startTime,
      });
    }

    // Build raw segment list (no speaker yet)
    interface Segment {
      speaker: string;
      text: string;
      start?: number;
      end?: number;
    }

    const rawSegments: Segment[] = (speechSegments.length > 0 ? speechSegments : groqSegments)
      .filter((s: any) => s?.text?.trim())
      .map((s: any) => ({
        speaker: 'unknown',
        text: s.text.trim(),
        start: s.start,
        end: s.end,
      }));

    if (rawSegments.length === 0 && fullTranscript) {
      rawSegments.push({ speaker: 'unknown', text: fullTranscript });
    }

    // ===== STEP 3: CLASSIFY SPEAKERS WITH GROQ LLM =====
    // Groq Whisper doesn't do audio diarization.
    // We use the LLM to infer who is speaking from context:
    // - "You" = the person holding the phone (shorter responses, questions, agreement)
    // - "Caller" = the other person on the line (makes requests, gives instructions)
    // - "Unknown" = cannot determine from text alone
    //
    // Key signal: in scam calls, the CALLER does most of the talking and makes requests.
    // The USER tends to respond with short answers, questions, or compliance phrases.

    const segmentTexts = rawSegments.map((s, i) => `[${i}] "${s.text}"`).join('\n');

    try {
      const speakerResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are a speaker classification expert for phone call transcripts.

Classify each segment as one of:
- "you" = the person holding the phone (user). Typically: short responses, questions, uncertainty, compliance ("okay", "sure", "I understand", "what do you mean"), giving personal info when asked.
- "caller" = the other person on the line. Typically: longer explanations, makes requests, gives instructions, claims authority, urgency.
- "unknown" = cannot determine from text alone.

Return ONLY a JSON array of roles matching the number of segments.
Example: ["caller", "you", "caller", "you", "unknown"]

Rules:
- If one person speaks 80%+ of the time, they are likely the "caller" (scammer).
- Short "uh huh", "yes", "okay", "I see" phrases are almost always "you".
- Imperative commands ("Don't tell", "Go to", "Send", "Stay on the line") are almost always "caller".
- If context shows a scam call, the caller making demands = "caller", person complying = "you".
- Return EXACTLY the same number of labels as input segments.`,
            },
            {
              role: 'user',
              content: `Call context: ${session_context ? session_context.slice(0, 500) : 'No prior context'}
Speaker history: ${speaker_history || 'None'}

Segments to classify:
${segmentTexts}

Return JSON array of roles only:`,
            },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(2000),
      });

      if (speakerResponse.ok) {
        const speakerData = await speakerResponse.json();
        const content = speakerData.choices?.[0]?.message?.content || '';

        // Extract JSON array from response
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          const roles: string[] = JSON.parse(arrayMatch[0]);
          if (Array.isArray(roles) && roles.length === rawSegments.length) {
            roles.forEach((role, i) => {
              if (role === 'you' || role === 'caller' || role === 'unknown') {
                rawSegments[i].speaker = role;
              }
            });
          }
        }
      }
    } catch (e) {
      // Speaker classification failed — segments stay as "unknown"
      // Still functional, just won't show who said what
    }

    // Merge consecutive segments from same speaker into one
    const mergedSegments: Segment[] = [];
    for (const seg of rawSegments) {
      const prev = mergedSegments[mergedSegments.length - 1];
      if (prev && prev.speaker === seg.speaker) {
        prev.text += ' ' + seg.text;
        if (seg.end !== undefined) prev.end = seg.end;
      } else {
        mergedSegments.push({ ...seg });
      }
    }

    // ===== STEP 4: KEYWORD FAST-PATH =====
    const transcriptLower = fullTranscript.toLowerCase();
    const redFlags: string[] = [];

    const urgencyKeywords = ['urgent', 'act now', 'limited time', 'hurry', 'immediately', 'right now', 'do not wait', 'asap'];
    const moneyKeywords = ['gift card', 'wire transfer', 'crypto', 'bitcoin', 'prepaid', 'send money', 'money order', 'amazon card', 'itunes', 'zelle', 'cashapp', 'venmo'];
    const threatKeywords = ['arrest', 'lawsuit', 'freeze', 'legal action', 'federal', 'penalty', 'jail', 'court', 'deported', 'suspended'];
    const personalKeywords = ['social security', 'ssn', 'password', 'pin number', 'account number', 'routing number', 'credit card', 'bank account'];
    const impersonationKeywords = ['irs', 'fbi', 'police department', 'microsoft support', 'apple support', 'amazon security', 'bank security', 'paypal'];

    if (urgencyKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Urgency/pressure tactics detected');
    if (moneyKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Money transfer request detected');
    if (threatKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Threats or intimidation detected');
    if (personalKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Personal information request detected');
    if (impersonationKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Authority impersonation detected');

    const confidence = speechSegments.length > 0
      ? Math.max(...speechSegments.map((s: any) =>
          typeof s.avg_logprob === 'number' ? Math.max(0, Math.min(1, Math.exp(s.avg_logprob))) : 0.85
        ))
      : 0.85;

    // ===== STEP 5: INSTANT RETURN FOR OBVIOUS SCAMS =====
    if (redFlags.length >= 2) {
      return Response.json({
        transcript: fullTranscript,
        segments: mergedSegments,
        red_flags: redFlags,
        tactics_detected: ['Multiple scam indicators'],
        risk_level: 'high',
        is_scam: true,
        feedback: 'STOP — this has multiple scam indicators. Do not give any information. Hang up and call the organization directly using a number from their official website.',
        analysis: `Detected ${redFlags.length} scam indicators: ${redFlags.join('; ')}`,
        confidence: 0.95,
        timing_ms: Date.now() - startTime,
      });
    }

    // ===== STEP 6: LLM SCAM ANALYSIS (ONLY FOR AMBIGUOUS CASES) =====
    let analysis: any = {
      tactics_detected: [],
      risk_level: redFlags.length > 0 ? 'medium' : 'low',
      is_scam: false,
      feedback: '',
      analysis: redFlags.length > 0 ? 'One potential scam indicator detected. Stay cautious.' : 'No scam indicators detected.',
    };

    try {
      const llmResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'Classify this call for scam risk. Return compact JSON only.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                transcript: fullTranscript.slice(0, 400),
                red_flags: redFlags,
                speakers: mergedSegments.map(s => `${s.speaker}: ${s.text.slice(0, 80)}`).join('\n'),
                output_schema: {
                  tactics_detected: ['string'],
                  risk_level: 'low|medium|high',
                  is_scam: false,
                  feedback: 'coaching for user',
                  analysis: 'brief summary',
                },
              }),
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(1500),
      });

      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        const text = llmData.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(text);
        if (parsed.risk_level) analysis = parsed;
      }
    } catch {
      // Use default analysis above
    }

    return Response.json({
      transcript: fullTranscript,
      segments: mergedSegments,
      red_flags: redFlags,
      tactics_detected: analysis.tactics_detected || [],
      risk_level: analysis.risk_level || 'low',
      is_scam: analysis.is_scam ?? false,
      feedback: analysis.feedback || '',
      analysis: analysis.analysis || '',
      confidence,
      timing_ms: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('analyzeCallChunk error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});
