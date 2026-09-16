import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';
import {
  buildAnalysisPrompt,
  computeWeightedRisk,
  mergeRiskLevels,
  type ConversationTurn,
  type ScamAnalysisResult,
} from '../../shared/callGuardAnalysis.ts';

// 1 credit per finalized utterance analysis — NOT per arbitrary audio chunk.
// A 30-minute call produces roughly 60-100 utterances, not hundreds of chunks.
const CREDIT_COST = 1;

// ===== AUDIO RETRIEVAL =====
// Handles base64 (data URL or raw), and HTTP URLs (downloads to binary to
// avoid 302 redirect issues with the STT provider).
async function retrieveAudioBytes(
  input: string,
  mimeType?: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
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

  // Case 3: URL — download to binary
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const response = await fetch(input, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { bytes, mimeType: blob.type || mimeType || 'audio/webm' };
    } catch (e) {
      throw new Error(`Audio download failed: ${e.message}`);
    }
  }

  throw new Error('Invalid audio input: must be base64 or URL');
}

// ===== GROQ WHISPER STT (batch transcription) =====
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

  const file = new File([audioBytes], 'audio.webm', { type: mimeType });
  form.set('file', file);

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq STT ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return await response.json();
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

// ===== CONTEXTUAL SCAM ANALYSIS (LLM) =====
async function analyzeScamContext(
  base44: any,
  conversation: ConversationTurn[],
  reportedIndicators: string[],
  language: string
): Promise<ScamAnalysisResult> {
  const prompt = buildAnalysisPrompt(conversation, reportedIndicators, language);

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          risk_level: { type: "string", enum: ["low", "medium", "high"] },
          new_indicators: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                description: { type: "string" },
                confidence: { type: "number" },
              },
            },
          },
          warnings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                explanation: { type: "string" },
                action: { type: "string" },
                severity: { type: "string", enum: ["caution", "suspicious", "high"] },
              },
            },
          },
          feedback: { type: "string" },
          summary: { type: "string" },
        },
        required: ["risk_level"],
      },
    });

    // InvokeLLM with response_json_schema returns a parsed object
    const data = typeof result === 'string' ? JSON.parse(result) : result;

    const indicators = Array.isArray(data.new_indicators) ? data.new_indicators : [];
    const weighted = computeWeightedRisk(indicators, reportedIndicators);
    const llmLevel = data.risk_level || "low";
    const merged = mergeRiskLevels(llmLevel, weighted);

    return {
      risk_level: merged as "low" | "medium" | "high",
      new_indicators: indicators,
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      feedback: data.feedback || "",
      summary: data.summary || "",
    };
  } catch (e) {
    console.error("Scam analysis LLM error:", e?.message);
    // Graceful degradation: return low risk if the LLM is unavailable.
    // The transcript still reaches the user; only the analysis is deferred.
    return {
      risk_level: "low",
      new_indicators: [],
      warnings: [],
      feedback: "",
      summary: "Analysis temporarily unavailable.",
    };
  }
}

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

    const groqKey = Deno.env.get("GROQ_STT");
    if (!groqKey) {
      return Response.json({ error: "STT not configured" }, { status: 500 });
    }

    // ===== RETRIEVE AUDIO =====
    let audioBytes: Uint8Array;
    let actualMimeType: string;
    try {
      const audioData = await retrieveAudioBytes(audio_input, audio_mime);
      audioBytes = audioData.bytes;
      actualMimeType = audioData.mimeType;
    } catch (e) {
      return Response.json({ error: `Audio retrieval failed: ${e.message}` }, { status: 400 });
    }

    // ===== TRANSCRIBE (batch) =====
    let transcriptData: any;
    try {
      transcriptData = await transcribeWithGroq(audioBytes, actualMimeType, language, groqKey);
    } catch (groqError) {
      console.error("Groq STT error:", groqError.message);
      return Response.json({
        error: `Transcription failed: ${groqError.message}`,
        provider: "groq",
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
        provider: "groq",
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
      provider: "groq",
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