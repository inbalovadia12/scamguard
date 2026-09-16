import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';
import {
  buildAnalysisPrompt,
  computeWeightedRisk,
  mergeRiskLevels,
  analyzeScamContext,
  type ConversationTurn,
  type ScamAnalysisResult,
} from '../../shared/callGuardAnalysis.ts';

// 1 credit per finalized utterance analysis — NOT per arbitrary audio chunk.
// A 30-minute call produces roughly 60-100 utterances, not hundreds of chunks.
const CREDIT_COST = 1;

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

// ===== AUDIO RETRIEVAL =====
// Decodes base64 (data URL or raw) into bytes for upload to AssemblyAI.
// Public URLs are passed directly to AssemblyAI without downloading.
async function retrieveAudioBytes(
  input: string,
  mimeType?: string
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  // Case 1: Data URL
  if (input.startsWith('data:')) {
    const match = input.match(/data:([^;]+);base64,(.+)/);
    if (match) {
      const mime = match[1];
      const base64 = match[2];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return { bytes, mimeType: mime };
    }
  }

  // Case 2: Raw base64 (live browser path)
  if (/^[A-Za-z0-9+/\s]+=*$/.test(input) && input.length > 100) {
    try {
      const normalized = input.replace(/\s/g, '');
      const binaryString = atob(normalized);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return { bytes, mimeType: mimeType || 'audio/webm' };
    } catch { /* fall through */ }
  }

  // Case 3: URL — caller passes directly to AssemblyAI, no download needed
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return null;
  }

  throw new Error('Invalid audio input: must be base64 or URL');
}

// ===== ASSEMBLYAI UPLOAD =====
// Uploads raw audio bytes to AssemblyAI's storage and returns a playable URL.
async function uploadToAssemblyAI(
  audioBytes: Uint8Array,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${ASSEMBLYAI_BASE}/upload`, {
    method: 'POST',
    headers: { authorization: apiKey },
    body: audioBytes,
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AssemblyAI upload ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!data.upload_url) throw new Error('AssemblyAI upload returned no URL');
  return data.upload_url as string;
}

// ===== ASSEMBLYAI TRANSCRIPTION (batch, with speaker diarization) =====
// Submits a transcription request and polls until complete.
// Returns normalized segments (text + start/end in seconds) from utterances.
async function transcribeWithAssemblyAI(
  audioUrl: string,
  language: string,
  apiKey: string
): Promise<{ text: string; segments: { text: string; start: number; end: number }[] }> {
  // Build request — speaker_labels gives us utterances (segmented by speaker
  // with timestamps), which we feed to the audio-source-based speaker mapper.
  const requestBody: Record<string, any> = {
    audio_url: audioUrl,
    speaker_labels: true,
  };

  // Use explicit language_code for supported languages (more reliable on short
  // clips); fall back to auto-detection for the rest.
  const SUPPORTED_LANG_CODES = new Set([
    'en', 'en_uk', 'en_au', 'es', 'fr', 'de', 'it', 'pt', 'pt_br', 'pt_pt',
    'nl', 'hi', 'ja', 'zh', 'fi', 'ko', 'pl', 'ru', 'tr', 'uk', 'vi', 'sv',
    'cs', 'el', 'ms', 'id', 'fil', 'az', 'hr', 'kk', 'no', 'sk', 'sl', 'so',
    'sr', 'ta', 'te', 'th', 'lt', 'lv', 'ro',
  ]);
  const langLower = (language || '').toLowerCase();
  if (SUPPORTED_LANG_CODES.has(langLower)) {
    requestBody.language_code = langLower;
  } else {
    requestBody.language_detection = true;
  }

  // Submit
  const submitRes = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15000),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text();
    throw new Error(`AssemblyAI submit ${submitRes.status}: ${errorText.slice(0, 200)}`);
  }

  const submitData = await submitRes.json();
  const transcriptId = submitData.id;
  if (!transcriptId) throw new Error('AssemblyAI returned no transcript id');

  // Poll until complete. Short live utterances often finish in under a second,
  // so poll fast at first (250ms, then every 600ms) instead of waiting 2s per
  // check. Keep a generous total budget (~48s) for longer uploaded recordings.
  const MAX_POLLS = 80;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, i === 0 ? 250 : 600));

    const pollRes = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
      signal: AbortSignal.timeout(10000),
    });

    if (!pollRes.ok) {
      const errorText = await pollRes.text();
      throw new Error(`AssemblyAI poll ${pollRes.status}: ${errorText.slice(0, 200)}`);
    }

    const pollData = await pollRes.json();

    if (pollData.status === 'completed') {
      const text = pollData.text || '';
      // utterances carry speaker labels + ms timestamps; convert to seconds
      const segments = Array.isArray(pollData.utterances)
        ? pollData.utterances
            .filter((u: any) => u?.text?.trim())
            .map((u: any) => ({
              text: u.text.trim(),
              start: (u.start ?? 0) / 1000,
              end: (u.end ?? u.start ?? 0) / 1000,
            }))
        : [];
      return { text, segments };
    }

    if (pollData.status === 'error') {
      throw new Error(pollData.error || 'AssemblyAI transcription failed');
    }
    // status "queued" | "processing" → keep polling
  }

  throw new Error('AssemblyAI transcription timed out');
}

// ===== SPEAKER ASSIGNMENT =====
// Speaker is determined by the AUDIO SOURCE, not by text-guessing:
// - "system" / "phone_call": the captured audio is the caller's side only.
//   All segments = "caller".
// - "mic" / "upload": mixed audio (speakerphone). Use alternation based on
//   segment timestamp gaps — a gap > 1.2s likely indicates a turn change.
//   This is a best-effort heuristic; the user can correct labels in the UI.
function assignSpeakers(
  segments: any[],
  audioSource: string,
  previousSpeaker: string | null
): { speaker: string; text: string; timestamp?: number }[] {
  const isCallerOnly = audioSource === 'system' || audioSource === 'phone_call';

  if (isCallerOnly) {
    return segments
      .filter((s) => s?.text?.trim())
      .map((s) => ({
        speaker: "caller",
        text: s.text.trim(),
        timestamp: s.start,
      }));
  }

  // Mixed-audio mode: alternation based on gaps between segments
  let currentSpeaker = previousSpeaker === "caller" ? "you" : "caller";
  let prevEnd = 0;
  return segments
    .filter((s) => s?.text?.trim())
    .map((s) => {
      const start = s.start ?? prevEnd;
      // If there's a gap > 1.2s, a turn likely changed
      if (start - prevEnd > 1.2) {
        currentSpeaker = currentSpeaker === "caller" ? "you" : "caller";
      }
      prevEnd = s.end ?? start + 1;
      return {
        speaker: currentSpeaker,
        text: s.text.trim(),
        timestamp: start,
      };
    });
}

// Contextual scam analysis is shared — see analyzeScamContext in callGuardAnalysis.ts.

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Auth required" }, { status: 401 });

    let plan = user.subscription_plan || "starter";
    if (plan === "free") plan = "starter";
    if (plan === "elite") plan = "premium";
    if (plan !== "premium") {
      return Response.json({ error: "Premium required" }, { status: 403 });
    }

    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: "Insufficient credits",
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
      }, { status: 402 });
    }

    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, CREDIT_COST);
      if (!usage) throw new Error("Credit balance changed during analysis. Please try again.");
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };

    const body = await req.json();
    const audio_input = body.audio_input || body.audio_base64 || body.audio_url;
    const audio_mime = body.audio_mime || body.audio_mime_type || "audio/webm";
    const language = body.language || "en";
    const audioSource = body.audio_source || "mic"; // "system" | "phone_call" | "mic" | "upload"
    const previousSpeaker = body.previous_speaker || null;
    // The client sends the full conversation context (list of {speaker, text})
    // and the list of indicator types already reported, for deduplication.
    const conversationContext: ConversationTurn[] = Array.isArray(body.conversation_context)
      ? body.conversation_context
      : [];
    const reportedIndicators: string[] = Array.isArray(body.reported_indicators)
      ? body.reported_indicators
      : [];

    if (!audio_input) {
      return Response.json({ error: "audio_input required" }, { status: 400 });
    }

    const assemblyKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!assemblyKey) {
      return Response.json({ error: "STT not configured" }, { status: 500 });
    }

    // ===== RESOLVE AUDIO URL =====
    // Public URLs go straight to AssemblyAI; base64 is uploaded first.
    let audioUrl: string;
    try {
      const decoded = await retrieveAudioBytes(audio_input, audio_mime);
      if (decoded) {
        audioUrl = await uploadToAssemblyAI(decoded.bytes, assemblyKey);
      } else {
        // audio_input is already a public URL
        audioUrl = audio_input;
      }
    } catch (e) {
      return Response.json({ error: `Audio preparation failed: ${e.message}` }, { status: 400 });
    }

    // ===== TRANSCRIBE (AssemblyAI, batch with diarization) =====
    let transcriptData: { text: string; segments: { text: string; start: number; end: number }[] };
    try {
      transcriptData = await transcribeWithAssemblyAI(audioUrl, language, assemblyKey);
    } catch (sttError) {
      console.error("AssemblyAI STT error:", sttError.message);
      return Response.json({
        error: `Transcription failed: ${sttError.message}`,
        provider: "assemblyai",
      }, { status: 502 });
    }

    const fullTranscript = transcriptData.text || "";

    // Empty transcript (silence or noise) — no credit charged
    if (!fullTranscript.trim()) {
      return Response.json({
        transcript: "",
        segments: [],
        risk_level: "low",
        warnings: [],
        tactics_detected: [],
        new_indicators: [],
        feedback: "",
        provider: "assemblyai",
        credits_used: 0,
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // ===== ASSIGN SPEAKERS (audio-source based, not text-guessing) =====
    const rawSegments = (transcriptData.segments || []).filter((s: any) => s?.text?.trim());
    const speakerSegments = assignSpeakers(rawSegments, audioSource, previousSpeaker);

    // ===== BUILD CONVERSATION FOR ANALYSIS =====
    const fullConversation: ConversationTurn[] = [
      ...conversationContext,
      ...speakerSegments.map((s) => ({
        speaker: s.speaker as "caller" | "you" | "unknown",
        text: s.text,
      })),
    ];

    // ===== CONTEXTUAL SCAM ANALYSIS (LLM) =====
    const analysis = await analyzeScamContext(
      base44,
      fullConversation,
      reportedIndicators,
      language
    );

    const creditsRemaining = await chargeCredits();

    return Response.json({
      transcript: fullTranscript,
      segments: speakerSegments,
      risk_level: analysis.risk_level,
      warnings: analysis.warnings,
      new_indicators: analysis.new_indicators,
      tactics_detected: analysis.new_indicators.map((i) => i.type),
      red_flags: analysis.new_indicators.map((i) => i.description),
      feedback: analysis.feedback,
      summary: analysis.summary,
      provider: "assemblyai",
      speaker_detection_note:
        audioSource === "system" || audioSource === "phone_call"
          ? "Speaker: caller (captured from system audio)."
          : "Speaker labels are estimated from speech gaps. Tap any message to correct.",
      credits_used: CREDIT_COST,
      credits_remaining: creditsRemaining,
      credits_limit: getMonthlyCreditLimit(user),
      timing_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error("analyzeCallChunk error:", error?.message);
    return Response.json({ error: error?.message || "Failed" }, { status: 500 });
  }
});