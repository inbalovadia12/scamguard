import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Analyzes a chunk of audio from a live call/screen session for scam tactics.
//   1. Whisper STT (Groq) transcribes the audio chunk
//   2. Llama-3.3-70b (Groq) analyzes the transcript for scam patterns
//   3. Returns structured analysis: segments, risk level, warnings, coaching
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

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) return Response.json({ error: 'STT service not configured' }, { status: 500 });

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
        return Response.json({ error: 'Audio data is required' }, { status: 400 });
      }
      const audioResponse = await fetch(audio_url);
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    }

    const ext = contentType.includes('mp4') ? 'mp4'
      : contentType.includes('ogg') ? 'ogg'
      : contentType.includes('wav') ? 'wav'
      : contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3'
      : 'webm';

    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', language || 'en');
    formData.append('temperature', '0');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}` },
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text().catch(() => 'unknown');
      return Response.json({ error: `Groq STT failed: ${groqResponse.status} ${errText}` }, { status: 502 });
    }

    const groqResult = await groqResponse.json();
    const transcript: string = groqResult.text || '';
    const groqSegments = groqResult.segments || [];
    
    // Detect audio quality issues
    const audioQuality = {
      isLowConfidence: (groqResult.confidence_avg || 1) < 0.5, // Whisper confidence metric
      hasMultipleErrors: transcript.split(' ').length > 0 && (transcript.match(/\[inaudible\]/gi) || []).length > 2,
      isMostlyNoise: groqSegments.length > 0 && groqSegments.filter((s: any) => (s.text || '').length < 3).length / groqSegments.length > 0.6,
    };
    
    const audioQualityWarning = audioQuality.isLowConfidence || audioQuality.hasMultipleErrors || audioQuality.isMostlyNoise
      ? 'Note: Audio quality is poor — transcription may be inaccurate. Try moving closer to the speaker or using clearer audio.'
      : '';
    
    const formattedTranscript = groqSegments.length > 0
      ? groqSegments.map((s: any) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] "${s.text.trim()}"`).join('\n')
      : transcript;

    if (!transcript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        warnings: [],
        tactics_detected: [],
        analysis: '',
      });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const contextPrompt = session_context
      ? `\nPREVIOUS TRANSCRIPT (last few segments):\n${session_context}\n`
      : '';
    const historyPrompt = speaker_history
      ? `\nSPEAKER HISTORY (who spoke recently, oldest→newest): ${speaker_history}\n`
      : '';

    const systemPrompt = `Real-time scam detection agent on a live phone call. Determine WHO is speaking and detect scam tactics.

SPEAKERS: "scammer" = the other party (caller, makes requests, asks for money/info, creates urgency, threatens, offers deals). "victim" = app user (responds, provides info, asks questions, expresses doubt).

SPEAKER DETECTION (apply in priority order):
1. CONTENT IS PRIMARY: requests/money/urgency/threats/offers → scammer; info-sharing/agreement/questions/doubt → victim.
2. PATTERN: follow SPEAKER HISTORY — 2+ consecutive same speaker → next is likely the other.
3. QUESTION → ANSWER = speaker change.
4. No history → first speaker usually "scammer" (incoming calls).
5. Short replies ("yes", "okay", "I see", "sure", "right", "uh-huh") = listener responding = usually victim.
6. Timing gaps (end < next start) = possible speaker change, NOT certain — could be same speaker pausing.

FIX WHISPER ERRORS: merge "I R S" → "IRS", fix homophones, add missing punctuation, merge fragmented segments from the same speaker (same tone, no speaker-change signals).

SCAM CHECKS (scammer turns): urgency/time pressure, payment requests (gift cards/crypto/wire/prepaid), personal info (SSN/passwords/OTP/bank), impersonation (government/bank/tech support/family), threats (arrest/account closure/fines), too-good-to-be-true offers, remote access requests, secrecy demands ("don't tell anyone").
VICTIM CHECKS: sharing sensitive info? Pushing back well? Being manipulated?

Return JSON: segments [{speaker, text}], feedback (advice to victim if they spoke, else ""), is_scam, red_flags, risk_level (low/medium/high), warnings, tactics_detected, analysis (1-2 sentences).`;

    const userPrompt = `${contextPrompt}${historyPrompt}
TRANSCRIPT (Whisper segments with [start-end] timestamps):
${formattedTranscript}

Respond entirely in ${languageName}.`;

    const llmResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => 'unknown');
      return Response.json({ error: `LLM analysis failed: ${llmResponse.status} ${errText}` }, { status: 502 });
    }

    const llmResult = await llmResponse.json();
    const analysis = JSON.parse(llmResult.choices[0].message.content);

    const segments = analysis.segments || [];
    const fullTranscript = segments.map((s: any) => s.text).join(' ');
    const primarySpeaker = segments.length > 0 ? segments[0].speaker : 'unknown';

    return Response.json({
      transcript: fullTranscript || transcript,
      segments,
      speaker: primarySpeaker,
      feedback: analysis.feedback || '',
      is_scam: analysis.is_scam ?? false,
      red_flags: analysis.red_flags || [],
      risk_level: analysis.risk_level || 'low',
      warnings: analysis.warnings || [],
      tactics_detected: analysis.tactics_detected || [],
      analysis: analysis.analysis || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});