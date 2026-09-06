import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard - Groq Primary STT with Speaker Identification
 *
 * ARCHITECTURE:
 * 1. Groq Whisper (primary STT) - transcribes audio chunks
 * 2. Speaker Identification Layer - determines who is speaking
 * 3. Conversation Context Manager - maintains rolling context
 * 4. Scam Detector - analyzes speaker-aware transcript
 * 5. Deepgram Fallback - only if Groq fails
 *
 * KEY FIXES:
 * - 302 redirect: Download audio to binary, don't send URL
 * - Speaker tracking: Use Groq LLM to identify speakers consistently
 * - Context: Maintain conversation state across chunks
 * - Alerts: Suppress duplicate warnings for same behavior
 */

interface SpeakerSegment {
  speaker: 'caller' | 'you' | 'unknown';
  text: string;
  confidence: number;
  timestamp?: number;
}

interface ConversationState {
  segments: SpeakerSegment[];
  lastSpeaker?: 'caller' | 'you';
  flags: Map<string, number>; // Track which alerts we've shown
  context: string; // Summary for LLM
}

// In-memory conversation state (per user session)
const conversationStates = new Map<string, ConversationState>();

function getOrCreateConversationState(userId: string): ConversationState {
  if (!conversationStates.has(userId)) {
    conversationStates.set(userId, {
      segments: [],
      flags: new Map(),
      context: '',
    });
  }
  return conversationStates.get(userId)!;
}

// ===== AUDIO RETRIEVAL (FIX 302 REDIRECT) =====
async function retrieveAudioBytes(
  input: string,
  mimeType?: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  // Case 1: Base64 encoded audio
  if (input.startsWith('data:')) {
    const match = input.match(/data:([^;]+);base64,(.+)/);
    if (match) {
      const mime = match[1];
      const base64 = match[2];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { bytes, mimeType: mime };
    }
  }

  // Case 2: Raw base64 (the live browser path sends audio_base64 without a data: prefix)
  // Decode directly so the endpoint accepts both raw base64 and data URLs.
  if (/^[A-Za-z0-9+/\s]+=*$/.test(input) && input.length > 100) {
    try {
      const normalized = input.replace(/\s/g, '');
      const binaryString = atob(normalized);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { bytes, mimeType: mimeType || 'audio/webm' };
    } catch {
      // Fall through to URL/invalid-input handling.
    }
  }

  // Case 3: URL - download to binary (THIS FIXES 302 REDIRECT)
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const response = await fetch(input, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status}`);
      }

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const mime = blob.type || mimeType || 'audio/webm';

      return { bytes, mimeType: mime };
    } catch (e) {
      throw new Error(`Audio download failed: ${e.message}`);
    }
  }

  throw new Error('Invalid audio input: must be base64 or URL');
}

// ===== GROQ STT (PRIMARY PROVIDER) =====
async function transcribeWithGroq(
  audioBytes: Uint8Array,
  mimeType: string,
  language: string,
  groqKey: string
): Promise<any> {
  const form = new FormData();
  form.set('model', 'whisper-large-v3-turbo');
  form.set('language', language);
  form.set('response_format', 'verbose_json');
  form.set('timestamp_granularities[]', 'segment');

  // Send binary data directly (NOT a URL)
  const file = new File([audioBytes], 'audio.webm', { type: mimeType });
  form.set('file', file);

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq failed: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  return await response.json();
}

// ===== DEEPGRAM FALLBACK (ONLY IF GROQ FAILS) =====
async function transcribeWithDeepgram(
  audioBytes: Uint8Array,
  mimeType: string,
  language: string,
  deepgramKey: string
): Promise<any> {
  // Upload audio to Deepgram
  const form = new FormData();
  const file = new File([audioBytes], 'audio.webm', { type: mimeType });
  form.set('file', file);

  const uploadResponse = await fetch('https://api.deepgram.com/v1/listen', {
    method: 'POST',
    headers: {
      Authorization: `Token ${deepgramKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(8000),
  });

  if (!uploadResponse.ok) {
    throw new Error(`Deepgram failed: ${uploadResponse.status}`);
  }

  const data = await uploadResponse.json();

  // Convert Deepgram format to Groq-like format for compatibility
  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

  return {
    text,
    segments: words.map((w: any) => ({
      id: 0,
      seek: 0,
      start: w.start,
      end: w.end,
      text: w.word,
      avg_logprob: -0.5,
      no_speech_prob: 0.1,
      words: [w],
    })),
  };
}

// ===== SPEAKER IDENTIFICATION =====
async function identifySpeakers(
  segments: any[],
  conversationState: ConversationState,
  groqKey: string
): Promise<SpeakerSegment[]> {
  const segmentTexts = segments
    .filter((s: any) => s?.text?.trim())
    .map((s: any, i) => `[${i}] "${s.text.trim()}"`)
    .join('\n');

  const contextSummary = conversationState.segments
    .slice(-5) // Last 5 segments
    .map((s) => `${s.speaker}: ${s.text.slice(0, 50)}`)
    .join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            content: `You identify phone call speakers. Rules:
            
"you" = person holding phone:
  - Short responses: "yes", "okay", "I see", "hello"
  - Questions: "who is this", "what?"
  - Sounds uncertain/responsive
  
"caller" = other person:
  - Longer statements
  - Makes claims: "This is the hospital"
  - Makes requests: "Give me", "Send", "Pay"
  - Sounds authoritative
  - Talks more than "you"

Return ONLY a JSON array of speaker IDs matching segment count.
Example: ["you","caller","caller","you"]

MAINTAIN CONSISTENCY: If "you" speaks first, keep that pattern.`,
          },
          {
            role: 'user',
            content: `Previous context:
${contextSummary || 'None'}

New segments to classify (${segments.filter((s: any) => s?.text?.trim()).length} total):
${segmentTexts}

Return JSON array:`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*?\]/);

      if (jsonMatch) {
        try {
          const roles = JSON.parse(jsonMatch[0]);
          if (Array.isArray(roles)) {
            return segments
              .filter((s: any) => s?.text?.trim())
              .map((s: any, i) => ({
                speaker: roles[i] === 'caller' || roles[i] === 'you' ? roles[i] : 'unknown',
                text: s.text.trim(),
                confidence: 0.85,
                timestamp: s.start,
              }));
          }
        } catch {
          // JSON parse failed, use fallback
        }
      }
    }
  } catch {
    // LLM timeout, use heuristic
  }

  // FALLBACK: Heuristic identification
  return segments
    .filter((s: any) => s?.text?.trim())
    .map((s: any) => {
      const text = s.text.toLowerCase();
      const len = s.text.length;

      let speaker: 'caller' | 'you' | 'unknown' = 'unknown';
      if (len < 20 || text.match(/^(yes|okay|ok|what|who|hello|hi|sure|i see|uh huh)$/)) {
        speaker = 'you';
      } else if (
        text.includes('this is') ||
        text.includes('we need') ||
        text.includes('give') ||
        text.includes('pay') ||
        text.includes('send') ||
        len > 50
      ) {
        speaker = 'caller';
      }

      return {
        speaker,
        text: s.text.trim(),
        confidence: speaker === 'unknown' ? 0.4 : 0.85,
        timestamp: s.start,
      };
    });
}

// ===== SCAM DETECTION (SPEAKER-AWARE) =====
function detectScamIndicators(segments: SpeakerSegment[]): Array<{
  flag: string;
  speaker: string;
  confidence: number;
}> {
  const alerts: Array<{ flag: string; speaker: string; confidence: number }> = [];

  // Analyze by speaker
  const callerSegments = segments.filter((s) => s.speaker === 'caller');
  const youSegments = segments.filter((s) => s.speaker === 'you');

  const callerText = callerSegments.map((s) => s.text.toLowerCase()).join(' ');
  const youText = youSegments.map((s) => s.text.toLowerCase()).join(' ');

  // MONEY REQUEST from CALLER
  const moneyKeywords = [
    'credit card',
    'debit card',
    'wire transfer',
    'send money',
    'gift card',
    'payment',
    'fee',
  ];
  if (moneyKeywords.some((kw) => callerText.includes(kw))) {
    alerts.push({
      flag: 'money_request',
      speaker: 'caller',
      confidence: 0.9,
    });
  }

  // THREAT from CALLER
  const threatKeywords = ['die', 'death', 'arrest', 'jail', 'freeze', 'lawsuit'];
  if (threatKeywords.some((kw) => callerText.includes(kw))) {
    alerts.push({
      flag: 'threat',
      speaker: 'caller',
      confidence: 0.9,
    });
  }

  // URGENCY from CALLER
  const urgencyKeywords = ['immediately', 'right now', 'now', 'hurry', 'asap'];
  if (urgencyKeywords.some((kw) => callerText.includes(kw))) {
    alerts.push({
      flag: 'urgency',
      speaker: 'caller',
      confidence: 0.85,
    });
  }

  // PERSONAL INFO REQUEST from CALLER
  const personalKeywords = [
    'social security',
    'ssn',
    'password',
    'account number',
    'card number',
  ];
  if (personalKeywords.some((kw) => callerText.includes(kw))) {
    alerts.push({
      flag: 'personal_info_request',
      speaker: 'caller',
      confidence: 0.95,
    });
  }

  // AUTHORITY CLAIM from CALLER
  const authorityKeywords = ['hospital', 'police', 'fbi', 'irs', 'bank', 'microsoft'];
  if (authorityKeywords.some((kw) => callerText.includes(kw))) {
    alerts.push({
      flag: 'authority_claim',
      speaker: 'caller',
      confidence: 0.8,
    });
  }

  return alerts;
}

// ===== MAIN HANDLER =====
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
    // Accept the canonical audio_input field plus the two fields already used by
    // the live recorder and upload flow. This keeps the API backwards compatible.
    const audio_input = body.audio_input || body.audio_base64 || body.audio_url;
    const audio_mime = body.audio_mime || body.audio_mime_type || 'audio/webm';
    const language = body.language || 'en';

    if (!audio_input) {
      return Response.json({
        error: 'audio_input required',
        hint: 'Send audio_input, audio_base64, or audio_url.'
      }, { status: 400 });
    }

    const startTime = Date.now();
    const groqKey = Deno.env.get('GROQ_STT');
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');

    // ===== RETRIEVE AUDIO BYTES (FIX 302 REDIRECT) =====
    let audioBytes: Uint8Array;
    let actualMimeType: string;

    try {
      const audioData = await retrieveAudioBytes(audio_input, audio_mime);
      audioBytes = audioData.bytes;
      actualMimeType = audioData.mimeType;
    } catch (e) {
      return Response.json({ error: `Audio retrieval failed: ${e.message}` }, { status: 400 });
    }

    // ===== TRANSCRIBE: GROQ PRIMARY =====
    let transcriptData: any;
    let provider = 'groq';

    if (!groqKey) {
      return Response.json({ error: 'Groq STT not configured' }, { status: 500 });
    }

    try {
      transcriptData = await transcribeWithGroq(audioBytes, actualMimeType, language, groqKey);
    } catch (groqError) {
      console.error('Groq failed:', groqError.message);

      // ===== DEEPGRAM FALLBACK (ONLY IF GROQ FAILS) =====
      if (deepgramKey) {
        console.log('Groq failed, trying Deepgram fallback...');
        try {
          transcriptData = await transcribeWithDeepgram(
            audioBytes,
            actualMimeType,
            language,
            deepgramKey
          );
          provider = 'deepgram';
          console.log('Deepgram fallback succeeded');
        } catch (deepgramError) {
          console.error('Deepgram also failed:', deepgramError.message);
          return Response.json({ error: 'Both Groq and Deepgram failed' }, { status: 500 });
        }
      } else {
        return Response.json({ error: `Groq failed: ${groqError.message}` }, { status: 500 });
      }
    }

    const fullTranscript = transcriptData.text || '';
    if (!fullTranscript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        provider,
        timing_ms: Date.now() - startTime,
      });
    }

    // ===== IDENTIFY SPEAKERS =====
    const segments = (transcriptData.segments || []).filter((s: any) => s?.text?.trim());
    const conversationState = getOrCreateConversationState(user.id);
    const speakerSegments = await identifySpeakers(segments, conversationState, groqKey);

    // ===== DETECT SCAM INDICATORS =====
    const alerts = detectScamIndicators(speakerSegments);

    // ===== SUPPRESS DUPLICATE ALERTS =====
    const newAlerts = alerts.filter((alert) => {
      const key = `${alert.flag}`;
      const lastCount = conversationState.flags.get(key) || 0;

      if (lastCount === 0) {
        // First time seeing this alert - show it
        conversationState.flags.set(key, 1);
        return true;
      } else if (alert.confidence > 0.9 && lastCount < 2) {
        // High confidence alert - show up to 2 times
        conversationState.flags.set(key, lastCount + 1);
        return true;
      }

      // Suppress duplicate
      return false;
    });

    // ===== UPDATE CONVERSATION STATE =====
    conversationState.segments.push(...speakerSegments);
    conversationState.context = fullTranscript.slice(-500); // Keep rolling context

    // ===== GENERATE RESPONSE =====
    const redFlags = newAlerts.map((a) => `${a.flag} (from ${a.speaker})`);
    const tacticsDetected = newAlerts.map((a) => a.flag);
    const warnings = newAlerts.map((a) => {
      const labels: Record<string, string> = {
        money_request: 'Caller requested money or payment information.',
        threat: 'Caller used a threat or consequence to pressure you.',
        urgency: 'Caller used urgency or pressure to make you act immediately.',
        personal_info_request: 'Caller requested sensitive personal or account information.',
        authority_claim: 'Caller claimed to represent an organization or authority.',
      };
      return labels[a.flag] || `Suspicious behavior detected: ${a.flag}.`;
    });
    const isScam = newAlerts.length >= 2;
    const riskLevel = isScam ? 'high' : newAlerts.length === 1 ? 'medium' : 'low';

    return Response.json({
      transcript: fullTranscript,
      segments: speakerSegments,
      red_flags: redFlags,
      warnings,
      tactics_detected: tacticsDetected,
      risk_level: riskLevel,
      is_scam: isScam,
      feedback: isScam
        ? 'STOP — Multiple scam indicators. Hang up and contact the organization directly.'
        : newAlerts.length === 1
          ? 'Caution: One indicator detected. Verify independently.'
          : '',
      provider, // Which STT was used
      timing_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('analyzeCallChunk error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});
