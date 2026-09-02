import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard - Real Speaker Detection Fix
 *
 * FIXES:
 * 1. Proper speaker classification (you vs caller)
 * 2. Comprehensive keyword detection (all scam indicators)
 * 3. Segment merging to prevent fragmentation
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

    // ===== STEP 2: EXTRACT SEGMENTS =====
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

    // ===== STEP 3: BUILD RAW SEGMENTS =====
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

    // ===== STEP 4: CLASSIFY SPEAKERS WITH LLM =====
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
              content: `You classify phone call speakers. Rules:
              
"you" = the person holding the phone:
  - Opening with "Hi, this is..." when identifying themselves
  - Asking "Who is this?" 
  - Short responses: "okay", "yes", "I see", "what?"
  - Sounds confused or questioning
  - Asking for verification

"caller" = the OTHER person:
  - Makes claims: "This is the hospital", "I'm calling about"
  - Makes demands/requests: "Give me", "Send", "Pay"
  - Gives information/instructions
  - Creates urgency: "must pay now", "he's gonna die"
  - Sounds authoritative
  - Makes threats
  - Talks much more than "you"

For EACH segment, respond with ONLY the role: "you" or "caller". No explanations.
If 2+ speakers, each segment must be classified as one of these two.
Return a JSON array: ["you", "caller", "caller", "you"]`,
            },
            {
              role: 'user',
              content: `Segments to classify (${rawSegments.length} total):
${rawSegments.map((s, i) => `[${i}] ${s.text}`).join('\n')}

Return JSON array of "${rawSegments.length}" roles: ["you"|"caller", ...]:`,
            },
          ],
          temperature: 0,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(2000),
      });

      if (speakerResponse.ok) {
        const speakerData = await speakerResponse.json();
        const content = speakerData.choices?.[0]?.message?.content || '';

        // Parse JSON array
        try {
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const roles: string[] = JSON.parse(jsonMatch[0]);
            if (Array.isArray(roles) && roles.length === rawSegments.length) {
              roles.forEach((role, i) => {
                if (role === 'you' || role === 'caller') {
                  rawSegments[i].speaker = role;
                }
              });
            }
          }
        } catch (parseErr) {
          // JSON parse failed, segments stay as unknown
        }
      }
    } catch (e) {
      // Speaker classification timeout/error - proceed with unknown
    }

    // ===== STEP 5: MERGE CONSECUTIVE SEGMENTS FROM SAME SPEAKER =====
    const mergedSegments: Segment[] = [];
    for (const seg of rawSegments) {
      const prev = mergedSegments[mergedSegments.length - 1];
      if (prev && prev.speaker === seg.speaker) {
        // Same speaker - append text
        prev.text += ' ' + seg.text;
        if (seg.end !== undefined) prev.end = seg.end;
      } else {
        // New speaker - create new segment
        mergedSegments.push({ ...seg });
      }
    }

    // ===== STEP 6: COMPREHENSIVE KEYWORD DETECTION =====
    const transcriptLower = fullTranscript.toLowerCase();
    const redFlags: string[] = [];

    // URGENCY / PRESSURE
    const urgencyPatterns = [
      'urgent', 'act now', 'immediately', 'hurry', 'right now', 'asap',
      'limited time', 'don\'t wait', 'do not wait', 'quickly',
      'before', 'deadline', 'expire', 'expiration', 'timeout',
    ];
    if (urgencyPatterns.some(p => transcriptLower.includes(p))) {
      redFlags.push('Urgency/pressure tactics detected');
    }

    // MONEY / PAYMENT REQUESTS
    const moneyPatterns = [
      'credit card', 'credit card number', 'debit card',
      'wire transfer', 'wire money', 'wiring',
      'gift card', 'gift cards', 'amazon card', 'itunes card', 'target card',
      'bitcoin', 'crypto', 'cryptocurrency', 'ethereum',
      'send money', 'transfer money', 'payment', 'pay',
      'money order', 'cashapp', 'venmo', 'zelle',
      'bank account', 'routing number',
      'fee', 'pay the fee', 'unpaid fee', 'balance due',
    ];
    if (moneyPatterns.some(p => transcriptLower.includes(p))) {
      redFlags.push('Money/payment request detected');
    }

    // THREATS / INTIMIDATION
    const threatPatterns = [
      'arrest', 'lawsuit', 'legal action', 'court',
      'freeze', 'frozen account', 'suspend', 'suspended',
      'federal', 'fbi', 'irs',
      'penalty', 'fine', 'jail', 'prison',
      'die', 'death', 'kill', 'gonna die', 'will die',
      'deport', 'deported', 'immigration',
      'report', 'reported',
    ];
    if (threatPatterns.some(p => transcriptLower.includes(p))) {
      redFlags.push('Threats/intimidation detected');
    }

    // PERSONAL INFO REQUESTS
    const personalPatterns = [
      'social security', 'ssn', 'password', 'pin',
      'account number', 'routing number', 'account',
      'verify', 'confirm', 'verify identity',
      'personal information', 'personal info',
      'date of birth', 'dob',
    ];
    if (personalPatterns.some(p => transcriptLower.includes(p))) {
      redFlags.push('Personal information request detected');
    }

    // AUTHORITY IMPERSONATION
    const impersonationPatterns = [
      'hospital', 'doctor', 'surgery',
      'police', 'police department',
      'fbi', 'irs', 'federal',
      'microsoft', 'apple', 'amazon', 'google',
      'tech support', 'support team',
      'bank', 'banking', 'credit', 'loan',
      'government',
    ];
    if (impersonationPatterns.some(p => transcriptLower.includes(p))) {
      redFlags.push('Authority impersonation detected');
    }

    const confidence = speechSegments.length > 0
      ? Math.max(...speechSegments.map((s: any) =>
          typeof s.avg_logprob === 'number' ? Math.max(0, Math.min(1, Math.exp(s.avg_logprob))) : 0.85
        ))
      : 0.85;

    // ===== STEP 7: INSTANT RETURN FOR OBVIOUS SCAMS =====
    if (redFlags.length >= 2) {
      return Response.json({
        transcript: fullTranscript,
        segments: mergedSegments,
        red_flags: redFlags,
        tactics_detected: ['Multiple scam indicators'],
        risk_level: 'high',
        is_scam: true,
        feedback: 'STOP — this call has multiple scam indicators. Do NOT give any personal information or money. Hang up immediately and call the organization directly using the number from their official website.',
        analysis: `Critical: Detected ${redFlags.length} scam indicators: ${redFlags.join('; ')}`,
        confidence: 0.95,
        timing_ms: Date.now() - startTime,
      });
    }

    // ===== STEP 8: LLM ANALYSIS FOR AMBIGUOUS CASES =====
    let analysis: any = {
      tactics_detected: [],
      risk_level: redFlags.length > 0 ? 'medium' : 'low',
      is_scam: false,
      feedback: '',
      analysis: redFlags.length > 0 ? 'Potential scam indicator detected. Be cautious.' : 'No scam indicators detected.',
    };

    if (redFlags.length === 1) {
      // One flag - might be legitimate. Use LLM to decide.
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
                content: 'Assess call for scam risk. Return JSON only.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  transcript: fullTranscript.slice(0, 400),
                  red_flags: redFlags,
                  speakers: mergedSegments.map(s => `${s.speaker}: ${s.text}`).join('\n'),
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
          try {
            analysis = JSON.parse(text);
          } catch {
            // JSON parse failed, use default
          }
        }
      } catch {
        // LLM timeout, use default analysis
      }
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
