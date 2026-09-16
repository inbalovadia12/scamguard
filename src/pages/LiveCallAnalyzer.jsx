import React, { useState, useEffect, useRef } from "react";
import { Radio, Phone, Monitor, Mic, Loader2, Crown, ShieldAlert, AlertTriangle, ShieldCheck, Square, Activity, Eye, Info, Upload } from "lucide-react";
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
// Mic / system / phone-call audio is streamed in real time to AssemblyAI's
// Streaming v3 WebSocket. A short-lived token (minted server-side) lets the
// browser connect without exposing the API key. An AudioWorklet downsamples
// the mic to 16 kHz PCM16 and forwards frames to the socket. AssemblyAI emits
// partial transcripts (shown live) and finalized turns (sent to analyzeCallSegment
// for scam analysis). Uploaded recordings still use the batch analyzeCallChunk.

const SCREEN_INTERVAL_OPTIONS = [
  { label: "1 sec", ms: 1000, credits: 8 },
  { label: "3 sec", ms: 3000, credits: 5 },
  { label: "5 sec", ms: 5000, credits: 3 },
];
const RISK_ORDER = { low: 0, medium: 1, high: 2 };

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/5", border: "border-success/20", icon: ShieldCheck, label: "Normal" },
  medium: { color: "text-warning", bg: "bg-warning/5", border: "border-warning/20", icon: AlertTriangle, label: "Caution" },
  high: { color: "text-destructive", bg: "bg-destructive/5", border: "border-destructive/20", icon: ShieldAlert, label: "High Risk" },
};

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
  const [screenInterval, setScreenInterval] = useState(SCREEN_INTERVAL_OPTIONS[2]);
  const supportsDisplayMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

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
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const aiStreamRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const screenIntervalRef = useRef(null);
  const videoRef = useRef(null);
  const wakeLockRef = useRef(null);
  const userStoppedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef([]);
  const overallRiskRef = useRef("low");
  const reportedIndicatorsRef = useRef([]);
  const lastSpeakerRef = useRef(null);

  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);

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
    if (screenIntervalRef.current) { clearInterval(screenIntervalRef.current); screenIntervalRef.current = null; }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; videoRef.current = null; }
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

  const resetState = () => {
    setTranscript([]);
    setWarnings([]);
    setOverallRisk("low");
    setTactics([]);
    setCoaching([]);
    setSpeakerDetectionNote("");
    setCallSeconds(0);
    setPartialText("");
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
      : (!lastSpeakerRef.current ? "caller" : (lastSpeakerRef.current === "caller" ? "you" : "caller"));
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
      if (mode === "screen") {
        await startScreenCapture();
        return;
      }

      // mic, system, phone_call → live streaming
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Your browser doesn't support audio capture.");

      const isCallerOnly = mode === "system" || mode === "phone_call";
      let mediaStream;
      if (mode === "mic") {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
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
        onError: (e) => {
          if (!userStoppedRef.current) setError("Live transcription connection error. Tap Start to resume.");
        },
        onClose: (code, reason) => {
          if (!userStoppedRef.current) {
            setIsListening(false);
            setIsRecording(false);
            if (code && code !== 1000 && code !== 1001) {
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

  const handleStop = () => {
    userStoppedRef.current = true;

    if (transcript.length > 0 || warnings.length > 0) {
      const sessionType = mode === "mic" ? "microphone" : mode === "screen" ? "screen_view" : "system_audio";
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
  };

  const analyzeUploadedRecording = async (file) => {
    setError(null);
    resetState();
    setUploading(true);
    try {
      if (!file.type.startsWith("audio/")) throw new Error("Please choose an audio file (m4a, mp3, wav, etc.).");
      if (file.size > 25 * 1024 * 1024) throw new Error("This recording is over 25 MB. Trim it or export a smaller file.");

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

  const startScreenCapture = async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    displayStreamRef.current = displayStream;

    const video = document.createElement("video");
    video.srcObject = displayStream;
    video.muted = true;
    video.autoplay = true;
    videoRef.current = video;
    await video.play();

    displayStream.getVideoTracks()[0].onended = () => handleStop();

    const captureFrame = async () => {
      if (isProcessingRef.current) return;
      if (!video.videoWidth || !video.videoHeight) return;
      isProcessingRef.current = true;
      setAnalyzing(true);

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
        if (!blob) throw new Error("Failed to capture screen frame.");
        const imageFile = new File([blob], `screen-${Date.now()}.jpg`, { type: "image/jpeg" });
        const uploadRes = await base44.integrations.Core.UploadPublicFile({ file: imageFile });

        const lang = localStorage.getItem("vardin_language") || "en";
        const recentContext = transcriptRef.current.slice(-3).map((t) => `${t.speaker}: ${t.text}`).join(" ");

        const response = await base44.functions.invoke("analyzeScreenCapture", {
          image_url: uploadRes.file_url,
          language: lang,
          session_context: recentContext,
          credit_cost: screenInterval.credits,
        });

        if (response.data?.error) throw new Error(response.data.error);
        const result = response.data;

        const newSeg = { text: result.analysis || "Screen analyzed", timestamp: new Date(), risk_level: result.risk_level };
        setTranscript((prev) => [...prev, newSeg]);
        transcriptRef.current = [...transcriptRef.current, newSeg];

        if (result.warnings?.length) {
          setWarnings((prev) => [...result.warnings.map((w) => ({ title: w, explanation: "", action: "", severity: "caution", timestamp: new Date(), level: result.risk_level })), ...prev]);
        }
        if (RISK_ORDER[result.risk_level] > RISK_ORDER[overallRiskRef.current]) {
          overallRiskRef.current = result.risk_level;
          setOverallRisk(result.risk_level);
        }
        if (result.tactics_detected?.length) setTactics((prev) => [...new Set([...prev, ...result.tactics_detected])]);
        if (typeof result.credits_remaining === "number") {
          setCreditStatus((prev) => (prev ? { ...prev, remaining: result.credits_remaining } : prev));
        } else {
          setCreditStatus(await getCreditStatus());
        }
      } catch (e) {
        setError(e.message || "Failed to analyze screen capture.");
      } finally {
        isProcessingRef.current = false;
        setAnalyzing(false);
      }
    };

    captureFrame();
    screenIntervalRef.current = setInterval(captureFrame, screenInterval.ms);
    setIsListening(true);
    requestWakeLock();
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
            <Radio className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-heading">Live Guard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time scam detection during calls, meetings, and on-screen messages. Get contextual warnings as indicators accumulate.
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

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
        {!isListening ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Choose audio source:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button onClick={() => setMode("mic")} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${mode === "mic" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Mic className={`w-6 h-6 ${mode === "mic" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Microphone</span>
                <span className="text-xs text-muted-foreground">Speakerphone</span>
              </button>
              <button onClick={() => !isMobile && setMode("system")} disabled={isMobile} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${isMobile ? "opacity-40 cursor-not-allowed border-border/30" : mode === "system" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Monitor className={`w-6 h-6 ${mode === "system" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">System Audio</span>
                <span className="text-xs text-muted-foreground">{isMobile ? "Desktop only" : "Zoom, Teams, browser"}</span>
              </button>
              <button onClick={() => !isMobile && setMode("phone_call")} disabled={isMobile} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${isMobile ? "opacity-40 cursor-not-allowed border-border/30" : mode === "phone_call" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Phone className={`w-6 h-6 ${mode === "phone_call" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Phone Call</span>
                <span className="text-xs text-muted-foreground">{isMobile ? "Desktop only" : "VoIP & device calls"}</span>
              </button>
              <button onClick={() => !isMobile && setMode("screen")} disabled={isMobile} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${isMobile ? "opacity-40 cursor-not-allowed border-border/30" : mode === "screen" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Eye className={`w-6 h-6 ${mode === "screen" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Screen View</span>
                <span className="text-xs text-muted-foreground">{isMobile ? "Desktop only" : "SMS, WhatsApp, Email"}</span>
              </button>
              <button onClick={() => setMode("upload")} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${mode === "upload" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                <Upload className={`w-6 h-6 ${mode === "upload" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Upload Recording</span>
                <span className="text-xs text-muted-foreground">Recorded call audio</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzeUploadedRecording(f); }} />
            {mode === "mic" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Mic className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">Put your call on <strong>speakerphone</strong> near the device. Live Guard streams audio in real time and analyzes each completed turn for scam indicators.</p>
              </div>
            )}
            {(mode === "system" || mode === "phone_call") && (
              supportsDisplayMedia ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Phone className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {mode === "phone_call" ? "Start your call first (Zoom, Teams, Skype, or device call), then tap Start. Share your system audio when prompted." : 'Share a tab or your screen and check "Share audio" when prompted.'}
                  </p>
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
                  <p className="text-xs text-muted-foreground"><strong>Upload a call recording.</strong> Vardin transcribes and analyzes the conversation. Use m4a, mp3, wav, or another audio file up to 25 MB.</p>
                </div>
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
            <Button onClick={mode === "upload" ? () => fileInputRef.current?.click() : handleStart} className="w-full h-12" disabled={uploading || !creditStatus?.canAnalyze || ((mode === "system" || mode === "phone_call") && !supportsDisplayMedia)}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "screen" ? <Eye className="w-4 h-4" /> : mode === "upload" ? <Upload className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              {uploading ? "Analyzing recording..." : mode === "screen" ? "Start Watching" : mode === "upload" ? "Choose Recording" : mode === "phone_call" ? "Start Call Guard" : "Start Listening"}
            </Button>
            {mode === "screen" && !isMobile && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Capture every:</span>
                {SCREEN_INTERVAL_OPTIONS.map((opt) => (
                  <button key={opt.label} onClick={() => setScreenInterval(opt)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${screenInterval.label === opt.label ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                    {opt.label} · {opt.credits} cr
                  </button>
                ))}
              </div>
            )}
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
                <p className="text-sm font-semibold">{mode === "screen" ? "Watching Screen" : mode === "phone_call" ? "Guarding Phone Call" : mode === "mic" ? "Listening via Microphone" : "Listening via System Audio"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRecording ? "Capturing speech..." : analyzing ? "Analyzing turn..." : "Waiting for speech..."} · {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, "0")}
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={handleStop} className="gap-2">
              <Square className="w-4 h-4" /> Stop
            </Button>
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
          <TranscriptFeed segments={transcript} onEditSegment={handleEditSegment} isRecording={isRecording} analyzing={analyzing} mode={mode} partialText={partialText} />
          <WarningPanel warnings={warnings} tactics={tactics} coaching={coaching} />
        </div>
      )}

      {!isListening && transcript.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select an audio source to get real-time scam analysis with contextual risk assessment.</p>
        </div>
      )}
    </div>
  );
}