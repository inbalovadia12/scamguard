import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard - Ultra-Fast Speaker Detection
 * 
 * SPEED OPTIMIZATIONS:
 * - Aggressive polling timeout (30 seconds max)
 * - Return partial results if timeout
 * - Skip LLM for obvious cases
 * - Fast keyword detection first
 * - Parallel processing where possible
 * - Response within 4 seconds for 90% of calls
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
    const { audio_url, audio_base64, audio_mime, language, session_context = '' } = body;

    const groqKey = Deno.env.get('GROQ_STT');
    if (!groqKey) {
      return Response.json({ error: 'Groq speech-to-text is not configured' }, { status: 500 });
    }

    const startTime = Date.now();
    const languageCode = language === 'he' ? 'he' : language === 'es' ? 'es' : 'en';
    const form = new FormData();
    form.set('model', 'whisper-large-v3-turbo');
    form.set('language', languageCode);
    // Segment metadata lets us reject silent/hallucinated clips without delaying transcription.
    form.set('response_format', 'verbose_json');
    form.set('timestamp_granularities[]', 'segment');

    if (audio_url) {
      // Groq accepts public audio URLs directly, avoiding an extra upload hop.
      form.set('url', audio_url);
    } else if (audio_base64) {
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mimeType = audio_mime || 'audio/webm';
      const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
      form.set('file', new File([bytes], `call.${extension}`, { type: mimeType }));
    } else {
      throw new Error('No audio data');
    }

    // Groq Whisper returns the finished transcript in one request; no polling is required.
    const transcriptResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
      signal: AbortSignal.timeout(8000),
    });

    if (!transcriptResponse.ok) {
      const detail = await transcriptResponse.text().catch(() => '');
      throw new Error(`Groq transcription failed: ${transcriptResponse.status}${detail ? ` - ${detail.slice(0, 300)}` : ''}`);
    }

    const transcript = await transcriptResponse.json();
    const pollCount = 0;

    // ===== FAST KEYWORD SCAN (PARALLEL WITH POLLING) =====
    const urgencyKeywords = ['urgent', 'act now', 'limited time', 'hurry', 'immediately', 'right now', 'do not wait', 'asap'];
    const moneyKeywords = ['gift card', 'wire transfer', 'crypto', 'bitcoin', 'prepaid', 'payment', 'send money', 'money order', 'amazon card', 'itunes'];
    const threatKeywords = ['arrest', 'lawsuit', 'freeze', 'legal action', 'federal', 'penalty', 'jail', 'court'];
    const personalKeywords = ['ssn', 'social security', 'password', 'pin', 'account number', 'routing number', 'credit card', 'bank'];
    const impersonationKeywords = ['irs', 'fbi', 'police', 'microsoft', 'apple', 'amazon', 'bank', 'paypal'];

    // Reject segments that Groq identifies as silence or very low-confidence audio.
    const words = transcript.words || [];
    const groqSegments = Array.isArray(transcript.segments) ? transcript.segments : [];
    const speechSegments = groqSegments.filter((segment: any) => {
      const noSpeech = typeof segment?.no_speech_prob === 'number' ? segment.no_speech_prob : 0;
      const lowConfidence = typeof segment?.avg_logprob === 'number' && segment.avg_logprob < -1.5;
      return segment?.text?.trim() && noSpeech < 0.55 && !lowConfidence;
    });
    const candidateTranscript = speechSegments.length
      ? speechSegments.map((segment: any) => segment.text.trim()).join(' ')
      : groqSegments.length
        ? ''
        : (transcript.text || words.map((w: any) => w.text).join(' '));
    const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const normalizedCandidate = normalize(candidateTranscript);
    const normalizedContext = normalize(session_context);
    const isUncertainRepeat = normalizedCandidate.length > 0
      && normalizedContext.includes(normalizedCandidate)
      && groqSegments.some((segment: any) =>
        (typeof segment?.no_speech_prob === 'number' && segment.no_speech_prob >= 0.3)
        || (typeof segment?.avg_logprob === 'number' && segment.avg_logprob < -1.0)
      );
    const fullTranscript = isUncertainRepeat ? '' : candidateTranscript;
    const confidence = speechSegments.length
      ? Math.max(...speechSegments.map((segment: any) =>
          typeof segment.avg_logprob === 'number' ? Math.max(0, Math.min(1, Math.exp(segment.avg_logprob))) : 0.85
        ))
      : 0.85;

    // Early exit if no speech
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
        timing: { totalMs: Date.now() - startTime, pollCount },
      });
    }

    // Quick keyword scan
    const transcriptLower = fullTranscript.toLowerCase();
    const redFlags: string[] = [];

    if (urgencyKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Urgency detected');
    if (moneyKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Money request detected');
    if (threatKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Threats detected');
    if (personalKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Personal info request detected');
    if (impersonationKeywords.some(kw => transcriptLower.includes(kw))) redFlags.push('Impersonation detected');

    // ===== BUILD SPEAKER SEGMENTS =====
    interface Segment {
      speaker: string;
      text: string;
      confidence: number;
    }

    const segments: Segment[] = speechSegments
      .filter((segment: any) => segment?.text?.trim())
      .map((segment: any) => ({
        speaker: 'unknown',
        text: segment.text.trim(),
        confidence: typeof segment.avg_logprob === 'number'
          ? Math.max(0, Math.min(1, Math.exp(segment.avg_logprob)))
          : confidence,
      }));

    if (segments.length === 0 && fullTranscript.trim()) {
      segments.push({ speaker: 'unknown', text: fullTranscript.trim(), confidence });
    }

    // Groq STT does not perform speaker diarization, so transcripts are kept as
    // timestamped, editable unknown-speaker segments for Call Guard.
    let currentSegment: Segment | null = null;
    const speakerSet = new Set<number>();

    for (const word of words) {
      const speakerNum = word.speaker;
      if (speakerNum !== null && speakerNum !== undefined) {
        speakerSet.add(speakerNum);
      }

      const speaker = speakerNum !== null && speakerNum !== undefined
        ? `Speaker ${speakerNum}`
        : 'Unknown Speaker';

      const wordText = word.text || '';
      const conf = word.confidence || 0.8;

      if (!currentSegment || currentSegment.speaker !== speaker) {
        if (currentSegment) segments.push(currentSegment);
        currentSegment = {
          speaker: speaker,
          text: wordText,
          confidence: conf,
        };
      } else {
        currentSegment.text += ' ' + wordText;
        currentSegment.confidence = (currentSegment.confidence + conf) / 2;
      }
    }
    if (currentSegment) segments.push(currentSegment);

    // ===== FALLBACK SPEAKER DETECTION =====
    if (speakerSet.size <= 1 && words.length > 30) {
      // Only try if we have enough data
      const energySegments: Segment[] = [];
      let tempSegment: Segment | null = null;
      let silenceCount = 0;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordText = word.text || '';
        const isSilent = wordText.trim().length === 0 || word.confidence < 0.3;

        if (isSilent) {
          silenceCount++;
          if (silenceCount > 3 && tempSegment) {
            // Significant silence = speaker change
            energySegments.push(tempSegment);
            tempSegment = null;
            silenceCount = 0;
          }
        } else {
          silenceCount = 0;
          if (!tempSegment) {
            const speaker = energySegments.length % 2 === 0 ? 'Speaker 0' : 'Speaker 1';
            tempSegment = {
              speaker: speaker,
              text: wordText,
              confidence: word.confidence || 0.8,
            };
          } else {
            tempSegment.text += ' ' + wordText;
            tempSegment.confidence = (tempSegment.confidence + (word.confidence || 0.8)) / 2;
          }
        }
      }

      if (tempSegment) energySegments.push(tempSegment);

      if (energySegments.length > 1) {
        segments.length = 0;
        segments.push(...energySegments);
      }
    }

    // ===== INSTANT RETURN FOR OBVIOUS SCAMS =====
    const isObviousScam = redFlags.length >= 2 && segments.length >= 2;
    if (isObviousScam) {
      return Response.json({
        transcript: fullTranscript,
        segments: segments,
        speaker: segments[0]?.speaker || 'Unknown',
        red_flags: redFlags,
        tactics_detected: ['Multiple scam indicators'],
        risk_level: 'high',
        is_scam: true,
        feedback: 'Hang up immediately. This is likely a scam.',
        analysis: 'Multiple scam indicators detected.',
        confidence: 0.95,
        timing: { totalMs: Date.now() - startTime, pollCount },
      });
    }

    // ===== SKIP LLM IF ALREADY CONFIDENT =====
    if (redFlags.length >= 2 || (redFlags.length === 0 && segments.length === 1)) {
      // Either high risk or clearly safe - don't need LLM
      return Response.json({
        transcript: fullTranscript,
        segments: segments,
        speaker: segments[0]?.speaker || 'Unknown',
        red_flags: redFlags,
        tactics_detected: [],
        risk_level: redFlags.length >= 2 ? 'high' : 'low',
        is_scam: redFlags.length >= 2,
        feedback: redFlags.length >= 2 ? 'Multiple scam indicators.' : '',
        analysis: redFlags.length > 0 
          ? `Detected ${redFlags.length} scam indicators.`
          : 'No scam indicators detected.',
        confidence: confidence,
        timing: { totalMs: Date.now() - startTime, pollCount },
      });
    }

    // Only a small ambiguous remainder reaches an LLM. Keep it entirely on Groq
    // and fail open to the fast heuristic if it cannot answer almost immediately.
    let analysis: any = {
      tactics_detected: redFlags,
      risk_level: redFlags.length ? 'medium' : 'low',
      is_scam: false,
      feedback: '',
      analysis: redFlags.length ? 'Suspicious indicator detected.' : 'No scam indicators detected.',
    };

    try {
      const llmResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.6-27b',
          messages: [
            {
              role: 'system',
              content: 'Classify the call excerpt for scam risk. Return only the requested compact JSON. Do not explain your reasoning.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                transcript: fullTranscript.slice(0, 300),
                red_flags: redFlags,
                output: {
                  tactics_detected: ['string'],
                  risk_level: 'low|medium|high',
                  is_scam: false,
                  feedback: 'string',
                  analysis: 'string',
                },
              }),
            },
          ],
          response_format: { type: 'json_object' },
          reasoning_effort: 'none',
          temperature: 0,
          max_completion_tokens: 80,
        }),
        signal: AbortSignal.timeout(750),
      });

      if (!llmResponse.ok) throw new Error(`Groq classifier failed: ${llmResponse.status}`);
      const llmData = await llmResponse.json();
      const text = llmData.choices?.[0]?.message?.content || '';
      analysis = JSON.parse(text);
    } catch {
      // Never delay an alert for an LLM response; retain the fast heuristic.
    }

    return Response.json({
      transcript: fullTranscript,
      segments: segments,
      speaker: segments[0]?.speaker || 'Unknown',
      red_flags: redFlags,
      tactics_detected: analysis.tactics_detected || [],
      risk_level: analysis.risk_level || 'low',
      is_scam: analysis.is_scam ?? false,
      feedback: analysis.feedback || '',
      analysis: analysis.analysis || '',
      confidence: confidence,
      timing: { totalMs: Date.now() - startTime, pollCount },
    });

  } catch (error: any) {
    console.error('Error:', error?.message);
    return Response.json({
      error: error?.message || 'Failed',
    }, { status: 500 });
  }
});
