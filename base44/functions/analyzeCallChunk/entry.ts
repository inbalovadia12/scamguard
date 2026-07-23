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
    const { audio_url, audio_base64, audio_mime, language, session_context, speaker_history } = body;

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) return Response.json({ error: 'STT service not configured' }, { status: 500 });

    let audioBlob: Blob;
    let contentType: string;

    if (audio_base64) {
      // Audio sent directly as base64 — skips UploadFile + download roundtrip
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

    const prompt = `Real-time scam detector analyzing a phone call chunk. "Victim" = app user. "Scammer" = other party. Whisper segments with [start-end] timestamps — a gap between segments (end < next start) = pause = likely speaker change. Short replies ("yes", "okay", "I see", "right", "sure") = the listener responding, not the current speaker continuing.
${contextPrompt}${historyPrompt}
TRANSCRIPT:
${formattedTranscript}

Detect speaker turns: continue the SPEAKER HISTORY pattern; if empty, first speaker is usually "scammer" (they initiate calls). A question followed by an answer = speaker change. Clean up transcription errors. For scammer turns, check: urgency, payment requests (gift cards/crypto/wire), personal info (SSN/passwords/OTP), impersonation, threats, too-good-to-be-true offers, remote access. For victim turns, check if sharing sensitive info or pushing back well.

Return JSON: segments [{speaker, text}], feedback (advice to victim if they spoke, else ""), is_scam, red_flags, risk_level (low/medium/high), warnings, tactics_detected, analysis (1-2 sentences). Respond in ${languageName}.`;

    const llmResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
      signal: AbortSignal.timeout(10000),
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