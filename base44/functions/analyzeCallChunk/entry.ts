import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Analyzes a chunk of audio from a live call for scam tactics.
 * Uses Deepgram for speech-to-text and Mistral for scam analysis.
 * Optimized for speed (~2-3s total vs 4-5s with Groq).
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

    // ---- SPEECH-TO-TEXT: Deepgram ----
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
    } else {
      if (!audio_url) {
        return Response.json({ error: 'Audio data is required' }, { status: 400 });
      }
      const audioResponse = await fetch(audio_url);
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    }

    // Deepgram speech-to-text (faster than Groq + better for phone quality)
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
      return Response.json({ error: `STT failed: ${deepgramResponse.status}` }, { status: 502 });
    }

    const deepgramResult = await deepgramResponse.json();
    
    // Extract transcript and segments from Deepgram
    const transcript = deepgramResult.results?.channels[0]?.alternatives[0]?.transcript || '';
    const deepgramUtterances = deepgramResult.results?.channels[0]?.alternatives[0]?.words || [];
    
    // Build formatted transcript with timestamps
    const formattedTranscript = deepgramUtterances.length > 0
      ? deepgramUtterances
          .map((w: any) => `[${w.start?.toFixed(2) || '0.00'}-${w.end?.toFixed(2) || '0.00'}] ${w.punctuated_word || w.word}`)
          .join(' ')
      : transcript;

    if (!transcript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        warnings: ['No speech detected in audio chunk. Try speaking louder or closer to the microphone.'],
        tactics_detected: [],
        analysis: 'No transcribable audio detected.',
      });
    }

    // Detect audio quality (Deepgram provides confidence)
    const avgConfidence = deepgramResult.results?.channels[0]?.alternatives[0]?.confidence || 1;
    const audioQualityWarning = avgConfidence < 0.6
      ? '📢 Audio quality is poor — transcription may be inaccurate. Move closer to the speaker or use a quieter environment.'
      : '';

    // ---- SCAM ANALYSIS: Mistral (free tier, ~800ms) ----
    const mistralKey = Deno.env.get('MISTRAL_API_KEY');
    const useMistral = !!mistralKey;

    let analysis: any = {};

    if (useMistral) {
      const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
      const languageName = LANGUAGE_NAMES[language] || 'English';

      const systemPrompt = `Real-time scam detection agent analyzing a live call transcript for scam tactics.

IDENTIFY SCAM PATTERNS:
- Urgency/time pressure
- Money/payment requests (gift cards, crypto, wire transfer)
- Personal info requests (SSN, passwords, OTP, bank details)
- Impersonation (IRS, FBI, bank, tech support, family member)
- Threats (arrest, account closure, penalties)
- Too-good-to-be-true offers
- Remote access requests
- Demands for secrecy

SPEAKER DETECTION:
- "scammer": makes requests, creates urgency, threatens, impersonates
- "victim": responds, shares info, asks questions, expresses doubt
- Short replies ("yes", "okay", "I see") = victim
- Long speeches, threats, pitches = scammer

Return valid JSON with: segments (speaker, text), red_flags (detected), risk_level (low/medium/high), is_scam (boolean), feedback (advice), tactics_detected (list).`;

      const userPrompt = `Analyze this call transcript for scam activity:

${formattedTranscript}

${session_context ? `\nPrevious context: ${session_context}` : ''}

Respond ONLY with valid JSON. No markdown, no explanation.`;

      try {
        const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mistralKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral-tiny',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0,
            max_tokens: 800,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (mistralResponse.ok) {
          const mistralResult = await mistralResponse.json();
          const content = mistralResult.choices[0]?.message?.content || '{}';
          try {
            analysis = JSON.parse(content);
          } catch {
            // Fallback if JSON parsing fails
            analysis = {
              segments: [{ speaker: 'unknown', text: transcript }],
              red_flags: [],
              risk_level: 'unknown',
              is_scam: false,
              feedback: '',
              tactics_detected: [],
            };
          }
        } else {
          console.warn('Mistral analysis failed, using fallback');
        }
      } catch (e) {
        console.error('Mistral API error:', e);
      }
    }

    // Fallback if Mistral not configured or failed
    if (!analysis.segments) {
      analysis = {
        segments: [{ speaker: 'unknown', text: transcript }],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        feedback: 'Analysis unavailable. Review transcript manually.',
        tactics_detected: [],
      };
    }

    return Response.json({
      transcript: transcript,
      segments: analysis.segments || [],
      speaker: analysis.segments?.[0]?.speaker || 'unknown',
      feedback: analysis.feedback || '',
      is_scam: analysis.is_scam ?? false,
      red_flags: analysis.red_flags || [],
      risk_level: analysis.risk_level || 'low',
      warnings: [...(analysis.warnings || []), ...(audioQualityWarning ? [audioQualityWarning] : [])],
      tactics_detected: analysis.tactics_detected || [],
      analysis: analysis.analysis || '',
      confidence: avgConfidence,
    });
  } catch (error) {
    console.error('analyzeCallChunk error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
