import React, { useState, useEffect, useRef } from "react";
import { Phone, Monitor, Mic, Loader2, Crown, AlertTriangle, ShieldCheck, Square, Activity, Info, Upload, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { getCreditStatus } from "@/lib/credits";
import TranscriptFeed from "@/components/call/TranscriptFeed";
import WarningPanel from "@/components/call/WarningPanel";
import AIDisclaimer from "@/components/AIDisclaimer";
import { useIsMobile } from "@/hooks/use-mobile";
import { AssemblyAIStream } from "@/lib/assemblyaiStream";

// === Live streaming architecture ===
// Mic / system audio is streamed in real time to AssemblyAI's Streaming v3
// WebSocket. A short-lived token (minted server-side) lets the browser connect
// without exposing the API key. An AudioWorklet downsamples the mic to 16 kHz
// PCM16 and forwards frames to the socket. AssemblyAI emits partial transcripts
// (shown live) and finalized turns (sent to analyzeCallSegment for scam
// analysis). Uploaded recordings still use the batch analyzeCallChunk.
//
// AssemblyAI streaming tokens expire after ~10 minutes. We surface this cap
// upfront, show a live countdown, and handle the session-end gracefully so
// the user can restart without seeing a scary error.

const SESSION_CAP_SECONDS = 600; // 10-minute provider limit
const MAX_RECORDING_SECONDS = 30 * 60; // 30-minute upload cap
const RISK_ORDER = { low: 0, medium: 1, high: 2 };

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/5", border: "border-success/20", icon: ShieldCheck, label: "Normal" },
  medium: { color: "text-warning", bg: "bg-warning/5", border: "border-warning/20", icon: AlertTriangle, label: "Caution" },
  high: { color: "text-destructive", bg: "bg-destructive/5", border: "border-destructive/20", icon: AlertTriangle, label: "High Risk" },
};

// Desktop VoIP apps whose audio can be captured via system-audio sharing.
const SUPPORTED_VOIP_APPS = ["Zoom", "Microsoft Teams", "Skype", "WhatsApp Desktop", "Google Meet"];

function getCallGuardError(error, fallback) {
  return error?.response?.data?.error || error?.data?.error || error?.message || fallback;
}

export default function LiveCallAnalyzer() {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "upload") return "upload";
      if (window.matchMedia("(max-width: 767px)").matches) return "mic";
    }
    return "system";
  });

  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [overallRisk, setOverallRisk] = useState("low");
  const [tactics, setTactics] = useState([]);
  const [coaching, setCoaching] = useState([]);
  const [speakerDetectionNote, setSpeakerDetectionNote] = useState("");
  const [error, setError] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fileDuration, setFileDuration] = useState(null);
  const [fileTooLong, setFileTooLong] = useState(false);
  const fileInputRef = useRef(null);

  const aiStreamRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const wakeLockRef = useRef(null);
  const userStoppedRef = useRef(false);
  const transcriptRef = useRef([]);
  const overallRiskRef = useRef("low");
  const reportedIndicatorsRef = useRef([]);
  const lastSpeakerRef = useRef(null);

  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  // Proactively end the session when the 10-minute provider cap is reached,
  // so the user sees a clean "session ended" message instead of a socket error.
  useEffect(() => {
    if (isListening && callSeconds >= SESSION_CAP_SECONDS) {
      setSessionEnded(true);
      handleStop(true);
    }
  }, [isListening, callSeconds]);

  useEffect(() => {
    if (!isListening) return;
    const handleVisibility = () => {
      if (!document.hidden) {
        if (audioContextRef.current?.state === "suspended") {
          audioContextRef.current.resume().catch(() => {});
        }
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isListening]);

  useEffect(() => {
    const init = async () => {
      const status = await getCreditStatus();
      setCreditStatus(status);
      setCheckingPlan(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (isMobile && mode !== "mic" && mode !== "upload") setMode("mic");
  }, [isMobile]);

  useEffect(() => {
    return () => { stopAllStreams(); };
  }, []);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
      }
    } catch { /* not supported */ }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  const stopAllStreams = () => {
    if (aiStreamRef.current) { aiStreamRef.current.terminate(); aiStreamRef.current = null; }
    if (workletNodeRef.current) { try { workletNodeRef.current.disconnect(); } catch {} workletNodeRef.current = null; }
    if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch {} sourceNodeRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    if (displayStreamRef.current) { displayStreamRef.current.getTracks().forEach((t) => t.stop()); displayStreamRef.current = null; }
  };

  const handleEditSegment = async (index, updates) => {
    setTranscript((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    transcriptRef.current = transcriptRef.current.map((t, i) => (i === index ? { ...t, ...updates } : t));
    if (updates.speaker) lastSpeakerRef.current = updates.speaker;

    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const context = transcriptRef.current.slice(-4).map((t) => `${t.speaker}: ${t.text}`).join("\n");
      const response = await base44.functions.invoke("generateCallFeedback", {
        text: updates.text,
        speaker: updates.speaker,
        context,
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      const newFeedback = response.data?.feedback || "";
      setTranscript((prev) => { const next = [...prev]; next[index] = { ...next[index], feedback: newFeedback }; return next; });
      transcriptRef.current[index].feedback = newFeedback;
    } catch { /* keep old feedback */ }
  };

  // Double-click the transcript box to swap the speaker labels of the last few
  // turns (you <-> caller). Keeps the transcript text and feedback unchanged.
  const handleSwapLastSpeakers = () => {
    const prev = transcriptRef.current;
    if (prev.length === 0) return;
    const n = Math.min(4, prev.length);
    const start = prev.length - n;
    const next = prev.map((t, i) => {
      if (i < start) return t;
      const s = t.speaker;
      return { ...t, speaker: s === "you" ? "caller" : s === "caller" ? "you" : s };
    });
    transcriptRef.current = next;
    setTranscript(next);
    lastSpeakerRef.current = next[next.length - 1].speaker;
  };

  const resetState = () => {
    setTranscript([]);
    setWarnings([]);
    setOverallRisk("low");
    setTactics([]);
    setCoaching([]);
    setSpeakerDetectionNote("");
    setCallSeconds(0);
    setPartialText("");
    setSessionEnded(false);
    transcriptRef.current = [];
    overallRiskRef.current = "low";
    reportedIndicatorsRef.current = [];
    lastSpeakerRef.current = null;
    userStoppedRef.current = false;
  };

  // Handle a finalized turn from AssemblyAI streaming: append it to the
  // transcript and run the contextual scam analysis (1 credit per turn).
  const handleFinalTurn = async (text, isCallerOnly) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const assignedSpeaker = isCallerOnly
      ? "caller"
      : (!lastSpeakerRef.current ? "you" : (lastSpeakerRef.current === "you" ? "caller" : "you"));
    const newSeg = { text: trimmed, timestamp: new Date(), risk_level: "low", speaker: assignedSpeaker, feedback: "" };
    setTranscript((prev) => [...prev, newSeg]);
    transcriptRef.current = [...transcriptRef.current, newSeg];
    lastSpeakerRef.current = assignedSpeaker;

    setAnalyzing(true);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const context = transcriptRef.current.slice(0, -1).slice(-10).map((t) => ({ speaker: t.speaker, text: t.text }));
      const res = await base44.functions.invoke("analyzeCallSegment", {
        text: trimmed,
        speaker: assignedSpeaker,
        conversation_context: context,
        reported_indicators: reportedIndicatorsRef.current,
        language: lang,
      });
      if (res.data?.error) throw new Error(res.data.error);
      const r = res.data;
      // Show coaching feedback inline for ALL speakers — the LLM's feedback
      // is advice TO the user about the conversation, not about who spoke.
      const segFeedback = r.feedback || "";
      setTranscript((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], risk_level: r.risk_level, feedback: segFeedback };
        return next;
      });
      const li = transcriptRef.current.length - 1;
      transcriptRef.current[li].risk_level = r.risk_level;
      transcriptRef.current[li].feedback = segFeedback;

      if (r.new_indicators?.length) {
        const newTypes = r.new_indicators.map((i) => i.type);
        reportedIndicatorsRef.current = [...new Set([...reportedIndicatorsRef.current, ...newTypes])];
        setTactics((prev) => [...new Set([...prev, ...newTypes])]);
      }
      if (r.warnings?.length) {
        setWarnings((prev) => [...r.warnings.map((w) => ({
          title: w.title, explanation: w.explanation, action: w.action,
          severity: w.severity || "caution", timestamp: new Date(), level: r.risk_level,
        })), ...prev]);
      }
      if (r.feedback) setCoaching((prev) => [{ text: r.feedback, timestamp: new Date(), risk_level: r.risk_level }, ...prev]);
      if (RISK_ORDER[r.risk_level] > RISK_ORDER[overallRiskRef.current]) {
        overallRiskRef.current = r.risk_level;
        setOverallRisk(r.risk_level);
      }
      if (typeof r.credits_remaining === "number") {
        setCreditStatus((prev) => (prev ? { ...prev, remaining: r.credits_remaining } : prev));
      }
    } catch (e) {
      setError(getCallGuardError(e, "Analysis failed for that segment."));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStart = async () => {
    setError(null);
    resetState();

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Your browser doesn't support audio capture.");

      const isCallerOnly = mode === "system";
      let mediaStream;
      if (mode === "mic") {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        // system → desktop VoIP app audio via screen-share-with-audio
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          displayStream.getTracks().forEach((t) => t.stop());
          throw new Error('No audio captured. Check "Share audio" when prompted.');
        }
        mediaStream = new MediaStream(audioTracks);
        displayStreamRef.current = displayStream;
        displayStream.getVideoTracks()[0].onended = () => handleStop();
      }
      mediaStreamRef.current = mediaStream;

      // Mint a short-lived streaming token (server-side, never exposes API key)
      const tokenRes = await base44.functions.invoke("createCallGuardStreamToken", {});
      if (tokenRes.data?.error) throw new Error(tokenRes.data.error);
      const token = tokenRes.data?.token;
      if (!token) throw new Error("Could not start live transcription session.");

      // Audio pipeline: AudioWorklet downsamples to PCM16/16kHz
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") await audioContext.resume();
      await audioContext.audioWorklet.addModule(new URL("../lib/pcmWorklet.js", import.meta.url));
      const source = audioContext.createMediaStreamSource(mediaStream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      source.connect(workletNode);
      audioContextRef.current = audioContext;
      sourceNodeRef.current = source;
      workletNodeRef.current = workletNode;

      // Streaming WebSocket — partials update the live line, finals trigger analysis
      const streamInstance = new AssemblyAIStream({
        token,
        onOpen: () => {
          setIsListening(true);
          requestWakeLock();
          setSpeakerDetectionNote(isCallerOnly
            ? "Speaker: caller (captured from system audio)."
            : "Speaker labels are estimated per turn. Tap any message to correct.");
        },
        onPartial: (text) => {
          setPartialText(text);
          setIsRecording(true);
        },
        onTurn: (text) => {
          setIsRecording(false);
          setPartialText("");
          handleFinalTurn(text, isCallerOnly);
        },
        onError: () => {
          if (!userStoppedRef.current) setError("Live transcription connection error. Tap Start to resume.");
        },
        onClose: (code, reason) => {
          if (!userStoppedRef.current) {
            setIsListening(false);
            setIsRecording(false);
            // If we're near the 10-min cap, treat as a graceful session end.
            if (callSeconds >= SESSION_CAP_SECONDS - 30) {
              setSessionEnded(true);
            } else if (code && code !== 1000 && code !== 1001) {
              setError(`Transcription disconnected (${code})${reason ? `: ${reason}` : ""}. Tap Start to resume.`);
            }
          }
        },
      });
      aiStreamRef.current = streamInstance;
      workletNode.port.onmessage = (e) => aiStreamRef.current?.sendAudio(e.data);
      streamInstance.connect();
    } catch (e) {
      const name = e?.name || "";
      const msg = e?.message || "Failed to start listening.";
      if (mode === "mic" && (name === "NotReadableError" || name === "SecurityError" || /could not start|in use|not allowed|denied|permission/i.test(msg))) {
        setError("Your phone keeps the mic for the call app, so the browser can't listen in during an active call. Put the call on speakerphone and use Microphone mode on a second device, or end the call and use Upload Recording.");
      } else {
        setError(msg);
      }
      stopAllStreams();
    }
  };

  const handleStop = (fromCap = false) => {
    userStoppedRef.current = true;

    if (transcript.length > 0 || warnings.length > 0) {
      const sessionType = mode === "mic" ? "microphone" : "system_audio";
      base44.entities.LiveGuardSession.create({
        session_type: sessionType,
        overall_risk: overallRisk,
        tactics_detected: tactics,
        warnings: warnings.map((w) => w.title || w.text || w),
        transcript: JSON.stringify(transcript.map((t) => ({ text: t.text, risk_level: t.risk_level, speaker: t.speaker }))),
        duration_seconds: callSeconds,
        segment_count: transcript.length,
      }).catch(() => {});
    }

    stopAllStreams();
    releaseWakeLock();
    setPartialText("");
    setIsListening(false);
    setIsRecording(false);
    setAnalyzing(false);
    if (fromCap) setSessionEnded(true);
  };

  const estimateFileDuration = (file) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(isFinite(audio.duration) ? audio.duration : 0);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      audio.src = url;
    });

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setFileTooLong(false);
    setFileDuration(null);
    if (!f.type.startsWith("audio/")) {
      setError("Please choose an audio file (m4a, mp3, wav, etc.).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("This recording is over 25 MB. Trim it or export a smaller file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const duration = await estimateFileDuration(f);
    if (duration > MAX_RECORDING_SECONDS) {
      setFileDuration(duration);
      setFileTooLong(true);
      setError(`This recording is ${Math.ceil(duration / 60)} minutes. The maximum is 30 minutes — please trim it and try again.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    analyzeUploadedRecording(f, duration);
  };

  const analyzeUploadedRecording = async (file, estimatedDuration = 0) => {
    setError(null);
    resetState();
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("analyzeCallChunk", {
        audio_input: uploadRes.file_url,
        audio_mime: file.type || "audio/mp4",
        language: lang,
        audio_source: "upload",
        conversation_context: [],
        reported_indicators: [],
      });
      if (response.data?.error) throw new Error(response.data.error);
      const result = response.data;
      if (!result.transcript && !result.segments?.length) {
        setError("Couldn't transcribe this recording. Try a clearer or shorter recording.");
      } else {
        populateUploadResult(result);
      }
      base44.entities.LiveGuardSession.create({
        session_type: "uploaded_recording",
        overall_risk: overallRiskRef.current,
        tactics_detected: result.tactics_detected || [],
        warnings: (result.warnings || []).map((w) => w.title || w),
        transcript: JSON.stringify((result.segments || []).map((s) => ({ text: s.text, risk_level: result.risk_level, speaker: s.speaker }))),
        segment_count: result.segments?.length || (result.transcript ? 1 : 0),
      }).catch(() => {});
      if (typeof result.credits_remaining === "number") {
        setCreditStatus((prev) => (prev ? { ...prev, remaining: result.credits_remaining } : prev));
      } else {
        setCreditStatus(await getCreditStatus());
      }
    } catch (e) {
      setError(getCallGuardError(e, "Failed to analyze recording."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const populateUploadResult = (result) => {
    if (result.segments?.length) {
      const newSegs = result.segments.map((seg) => ({
        text: seg.text, timestamp: new Date(), risk_level: result.risk_level,
        speaker: seg.speaker || "unknown", feedback: "",
      }));
      setTranscript(newSegs);
      transcriptRef.current = newSegs;
    } else if (result.transcript) {
      const newSeg = { text: result.transcript, timestamp: new Date(), risk_level: result.risk_level, speaker: "caller", feedback: "" };
      setTranscript([newSeg]);
      transcriptRef.current = [newSeg];
    }
    if (result.warnings?.length) {
      setWarnings(result.warnings.map((w) => ({
        title: w.title, explanation: w.explanation, action: w.action,
        severity: w.severity || "caution", timestamp: new Date(), level: result.risk_level,
      })));
    }
    if (result.tactics_detected?.length) setTactics(result.tactics_detected);
    if (result.feedback) setCoaching([{ text: result.feedback, timestamp: new Date(), risk_level: result.risk_level }]);
    if (result.speaker_detection_note) setSpeakerDetectionNote(result.speaker_detection_note);
    if (RISK_ORDER[result.risk_level] > RISK_ORDER[overallRiskRef.current]) {
      overallRiskRef.current = result.risk_level;
      setOverallRisk(result.risk_level);
    }
  };

  if (checkingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!creditStatus?.isPremiumPlan) {
    return (
      <div className="max-w-md mx-auto px-4">
        <div className="bg-card rounded-2xl border border-border/50 p-8 sm:p-10 text-center space-y-5 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-heading">Live Guard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time scam detection during calls and meetings. Get contextual warnings as indicators accumulate.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Crown className="w-4 h-4" /> Premium Feature
          </div>
          <Button asChild className="w-full">
            <Link to="/pricing">Upgrade to Premium</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cfg = RISK_CONFIG[overallRisk];
  const RiskIcon = cfg.icon;
  const supportsSystemAudio = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const remainingSeconds = Math.max(0, SESSION_CAP_SECONDS - callSeconds);
  const nearCap = remainingSeconds <= 60 && isListening;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      {/* 10-minute session cap notice */}
      {!isListening && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Live sessions auto-end after <strong>10 minutes</strong> (provider limit). Restart anytime to continue protecting a longer call. Each analyzed turn costs <strong>1 credit</strong>.
          </p>
        </div>
      )}

      {sessionEnded && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
          <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Session ended (10-minute limit reached)</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your transcript and warnings are saved. Start a new session to continue.</p>
          </div>
          <Button size="sm" onClick={() => { setSessionEnded(false); handleStart(); }} className="flex-shrink-0">
            Start New Session
          </Button>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
        {!isListening ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Choose audio source:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => setMode("mic")} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${mode === "mic" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Mic className={`w-6 h-6 ${mode === "mic" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Microphone</span>
                <span className="text-xs text-muted-foreground text-center">Speakerphone on a second device</span>
              </button>
              <button
                onClick={() => !isMobile && supportsSystemAudio && setMode("system")}
                disabled={isMobile || !supportsSystemAudio}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${isMobile || !supportsSystemAudio ? "opacity-40 cursor-not-allowed border-border/30" : mode === "system" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}
              >
                <Monitor className={`w-6 h-6 ${mode === "system" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">System Audio</span>
                <span className="text-xs text-muted-foreground text-center">{isMobile ? "Desktop only" : "Zoom, Teams, Skype, WhatsApp"}</span>
              </button>
              <button onClick={() => setMode("upload")} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${mode === "upload" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Upload className={`w-6 h-6 ${mode === "upload" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Upload Recording</span>
                <span className="text-xs text-muted-foreground text-center">Recorded call audio</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            {mode === "mic" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Mic className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">Put your call on <strong>speakerphone</strong> near the device. Live Guard streams audio in real time and analyzes each completed turn for scam indicators.</p>
              </div>
            )}
            {mode === "system" && (
              supportsSystemAudio ? (
                <div className="space-y-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Monitor className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Works with desktop VoIP apps. Start your call first, then tap Start and <strong>share system audio</strong> when prompted.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {SUPPORTED_VOIP_APPS.map((app) => (
                      <span key={app} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{app}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground pl-6 pt-1">Cannot capture cellular phone calls — use Upload Recording or Microphone + speakerphone for those.</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">System audio capture isn't available on this browser. Use <strong>Microphone</strong> mode, or try Chrome on desktop or Android.</p>
                </div>
              )
            )}
            {mode === "upload" && (
              <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Upload className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground"><strong>Upload a call recording.</strong> Vardin transcribes and analyzes the conversation. Use m4a, mp3, wav, or another audio file up to <strong>25 MB</strong> and <strong>30 minutes</strong> long.</p>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">1 credit / minute</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground font-medium">Max 30 min</span>
                </div>
                {fileTooLong && fileDuration && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">This recording is {Math.ceil(fileDuration / 60)} minutes. The maximum is 30 minutes — please trim it and try again.</p>
                  </div>
                )}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">How to record and upload a call</summary>
                  <div className="mt-2 space-y-2 leading-relaxed">
                    <p><strong>iPhone:</strong> where Call Recording is available, make or answer the call in Phone, tap More, then Call Recording. After the call, open Notes, save or share the audio file, then choose it here.</p>
                    <p><strong>Android:</strong> on supported devices, open Phone during the call and tap Record. Find the saved call in Phone, tap Share, save the audio file, then upload it here.</p>
                    <p><strong>If unavailable:</strong> use speakerphone and record from a second device, then upload that file.</p>
                  </div>
                </details>
              </div>
            )}
            <Button onClick={mode === "upload" ? () => fileInputRef.current?.click() : handleStart} className="w-full h-12" disabled={uploading || !creditStatus?.canAnalyze || (mode === "system" && (!supportsSystemAudio || isMobile))}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "upload" ? <Upload className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              {uploading ? "Analyzing recording..." : mode === "upload" ? "Choose Recording" : mode === "mic" ? "Start Listening" : "Start Call Guard"}
            </Button>
            {!creditStatus?.canAnalyze && <p className="text-xs text-warning text-center">You're out of AI credits for this month.</p>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                {isRecording ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-60" />
                  </>
                ) : analyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{mode === "mic" ? "Listening via Microphone" : "Listening via System Audio"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRecording ? "Capturing speech..." : analyzing ? "Analyzing turn..." : "Waiting for speech..."} · {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, "0")}
                  <span className={nearCap ? " text-warning font-medium" : ""}> / 10:00</span>
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => handleStop(false)} className="gap-2">
              <Square className="w-4 h-4" /> Stop
            </Button>
          </div>
        )}
        {nearCap && (
          <div className="flex items-center gap-2 text-sm text-warning">
            <Clock className="w-4 h-4 flex-shrink-0" />
            Session ends in {Math.ceil(remainingSeconds / 60)} min — start a new session to continue.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {(transcript.length > 0 || isListening) && (
        <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4 flex items-center gap-3`}>
          <RiskIcon className={`w-6 h-6 ${cfg.color}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
            <p className="text-xs text-muted-foreground">
              {transcript.length} turns · {warnings.length} warnings · {creditStatus?.remaining || 0} credits left
            </p>
            {speakerDetectionNote && <p className="text-xs text-muted-foreground mt-1">{speakerDetectionNote}</p>}
          </div>
          {tactics.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1.5 justify-end max-w-[40%]">
              {tactics.slice(0, 3).map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">{t.replace(/_/g, " ")}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <AIDisclaimer />

      {(transcript.length > 0 || warnings.length > 0 || isListening) && (
        <div className="grid sm:grid-cols-2 gap-4">
          <TranscriptFeed segments={transcript} onEditSegment={handleEditSegment} onSwapLastSpeakers={handleSwapLastSpeakers} isRecording={isRecording} analyzing={analyzing} mode={mode} partialText={partialText} />
          <WarningPanel warnings={warnings} tactics={tactics} coaching={coaching} />
        </div>
      )}

      {!isListening && transcript.length === 0 && !sessionEnded && (
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select an audio source to get real-time scam analysis with contextual risk assessment.</p>
        </div>
      )}
    </div>
  );
}