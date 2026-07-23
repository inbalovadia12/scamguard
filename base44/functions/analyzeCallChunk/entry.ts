import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
    const { audio_url, language, session_context, speaker_history } = body;

    if (!audio_url) {
      return Response.json({ error: 'Audio URL is required' }, { status: 400 });
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) return Response.json({ error: 'STT service not configured' }, { status: 500 });

    // Fetch audio and transcribe via Groq (much faster than built-in Whisper)
    const audioResponse = await fetch(audio_url);
    const audioBlob = await audioResponse.blob();
    const contentType = audioBlob.type || 'audio/webm';
    const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('ogg') ? 'ogg' : 'webm';

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

    const prompt = `You are a real-time scam detection agent analyzing a live phone call or meeting.

The audio was transcribed by speech recognition, which does NOT identify speakers. You must detect speaker turns from the text itself. The transcript is provided as Whisper segments with timestamps — each [start-end] line is a natural utterance boundary (a pause was detected between segments). Use these boundaries to help identify speaker turns.

CRITICAL CONTEXT: The "victim" is the person being protected (the app user). The "scammer" is the other party — who could be a scammer OR a legitimate caller (label them "scammer" regardless; the risk analysis determines if they're actually malicious).

Your job:
1. SPLIT the transcript into speaker turns. Each Whisper segment (timestamped line) is a natural utterance boundary — a new speaker often starts a new segment. Within a segment there is usually one speaker. Detect turn changes using:
   - Segment boundaries (each timestamped line is a separate utterance)
   - Questions followed by answers
   - Abrupt topic shifts or tone changes
   - Addressing the other party ("sir", "ma'am", names, "you")
   - Acknowledgments ("yes", "okay", "I see") following a statement
2. Label each turn: "scammer" (the other party) or "victim" (the protected user).
3. Use the SPEAKER HISTORY to alternate — if the last turn was "scammer", the next is likely "victim", and vice versa. If history is empty, the first speaker is usually the "scammer" (they typically initiate calls).
4. Clean up obvious transcription errors (filler artifacts, repeated words, misheard terms) using context, but preserve the original meaning.
${contextPrompt}${historyPrompt}
TRANSCRIPT CHUNK (Whisper segments with timestamps, may contain errors):
${formattedTranscript}

When the SCAMMER (other party) speaks, analyze for:
- Urgency or pressure tactics ("act now", "don't hang up", "limited time")
- Requests for gift cards, wire transfers, crypto, or unusual payment methods
- Requests for personal info (SSN, bank details, passwords, OTP codes)
- Impersonation (government, bank, tech support, family member in distress)
- Too-good-to-be-true offers (lottery, prizes, investment returns)
- Threats or intimidation (arrest, fines, account closure)
- Requests to install software or grant remote access
- Romance/investment scam patterns
- Requests to stay on the line or not tell anyone

When the VICTIM (user) speaks, evaluate:
- Are they giving out sensitive info they shouldn't? (warning needed)
- Are they pushing back appropriately? (encourage them!)
- Are they asking good verification questions? (encourage them!)
- Are they staying calm and not being pressured? (encourage them!)

Return:
- segments: Array of { speaker: "scammer"|"victim"|"unknown", text: string } — each detected turn in this chunk, in order. If only one person spoke, return a single segment. Clean up transcription errors in the text.
- feedback: If the victim spoke in any segment, give direct personal feedback — encouragement ("Great job not sharing your info!") or a warning ("Be careful — you just shared your address"). Empty if only the scammer spoke.
- is_scam: true if scam indicators are present, false if clearly legitimate/normal
- red_flags: Specific concerning phrases or behaviors detected (empty if none)
- risk_level: "low" (normal/legitimate OR no concerns), "medium" (some concerning elements), "high" (clear scam indicators)
- warnings: Short, actionable warning messages for the user
- tactics_detected: Named tactics if any (e.g., "Urgency", "Impersonation")
- analysis: Brief 1-2 sentence assessment. If NOT a scam, explicitly say so.

Respond entirely in ${languageName}.`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker: { type: 'string', enum: ['scammer', 'victim', 'unknown'] },
                text: { type: 'string' },
              },
              required: ['speaker', 'text'],
            },
          },
          feedback: { type: 'string' },
          is_scam: { type: 'boolean' },
          red_flags: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          warnings: { type: 'array', items: { type: 'string' } },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          analysis: { type: 'string' },
        },
        required: ['segments', 'risk_level', 'warnings', 'is_scam'],
      },
    });

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