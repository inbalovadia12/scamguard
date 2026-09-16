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

// === Utterance-based audio capture ===
// Previous: 250ms silence + 1500ms max → every brief pause split a sentence
// into multiple transcript messages.
// Now: 700ms silence boundary + 12s max → complete utterances are sent as
// single transcript entries. Natural mid-sentence pauses (breaths) don't
// trigger a split; only a real conversational turn-end does.
const SILENCE_THRESHOLD = 0.015;
const SILENCE_DURATION_MS = 700;
const MAX_UTTERANCE_MS = 12000;
const MIN_SPEECH_FRAMES = 3; // ~300ms of voice before we consider it speech

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

function getSupportedAudioMime() {
  const types = ["audio/webm", "audio/mp4", "audio/ogg", "audio/aac"];
  for (const type of types) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch { /* not available */ }
  }
  return "";
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
  const [isRecording, setIsRecording] = useState(false); // currently capturing an utterance
  const [analyzing, setAnalyzing] = useState(false); // waiting for transcription
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

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const screenIntervalRef = useRef(null);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const utteranceStartRef = useRef(0);
  const userStoppedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef([]);
  const overallRiskRef = useRef("low");
  const reportedIndicatorsRef = useRef([]);
  const lastSpeakerRef = useRef(null);
  const hasSpeechInUtteranceRef = useRef(false);

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
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      if (screenIntervalRef.current) clearInterval(screenIntervalRef.current);
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
      setTranscript((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], feedback: newFeedback };
        return next;
      });
      transcriptRef.current[index].feedback = newFeedback;
    } catch { /* keep old feedback */ }
  };

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

  // Send a complete utterance blob for transcription + contextual analysis.
  const processUtterance = async (blob, blobMime) => {
    if (isProcessingRef.current) return; // don't overlap
    isProcessingRef.current = true;
    setAnalyzing(true);
    setError(null);

    try {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });

      const lang = localStorage.getItem("vardin_language") || "en";
      const conversationContext = transcriptRef.current.slice(-10).map((t) => ({
        speaker: t.speaker,
        text: t.text,
      }));

      const response = await base44.functions.invoke("analyzeCallChunk", {
        audio_input: base64,
        audio_mime: blobMime,
        language: lang,
        audio_source: mode,
        previous_speaker: lastSpeakerRef.current,
        conversation_context: conversationContext,
        reported_indicators: reportedIndicatorsRef.current,
      });

      if (response.data?.error) throw new Error(response.data.error);
      const result = response.data;

      // Add transcribed segments to the transcript
      if (result.segments?.length) {
        const newSegs = result.segments.map((seg) => ({
          text: seg.text,
          timestamp: new Date(),
          risk_level: result.risk_level,
          speaker: seg.speaker || "unknown",
          feedback: seg.speaker === "you" ? (result.feedback || "") : "",
        }));
        setTranscript((prev) => [...prev, ...newSegs]);
        transcriptRef.current = [...transcriptRef.current, ...newSegs];
        lastSpeakerRef.current = result.segments[result.segments.length - 1].speaker;
      } else if (result.transcript) {
        const newSeg = {
          text: result.transcript,
          timestamp: new Date(),
          risk_level: result.risk_level,
          speaker: result.speaker || "caller",
          feedback: result.feedback || "",
        };
        setTranscript((prev) => [...prev, newSeg]);
        transcriptRef.current = [...transcriptRef.current, newSeg];
      }

      // Track reported indicators for deduplication
      if (result.new_indicators?.length) {
        const newTypes = result.new_indicators.map((i) => i.type);
        reportedIndicatorsRef.current = [...new Set([...reportedIndicatorsRef.current, ...newTypes])];
        setTactics((prev) => [...new Set([...prev, ...newTypes])]);
      }

      // Add warnings with the new structured format
      if (result.warnings?.length) {
        setWarnings((prev) => [
          ...result.warnings.map((w) => ({
            title: w.title,
            explanation: w.explanation,
            action: w.action,
            severity: w.severity || "caution",
            timestamp: new Date(),
            level: result.risk_level,
          })),
          ...prev,
        ]);
      }

      // Coaching feedback
      if (result.feedback) {
        setCoaching((prev) => [{ text: result.feedback, timestamp: new Date(), risk_level: result.risk_level }, ...prev]);
      }

      if (result.speaker_detection_note) setSpeakerDetectionNote(result.speaker_detection_note);

      // Update overall risk (monotonic — only goes up during a call)
      if (RISK_ORDER[result.risk_level] > RISK_ORDER[overallRiskRef.current]) {
        overallRiskRef.current = result.risk_level;
        setOverallRisk(result.risk_level);
      }

      if (typeof result.credits_remaining === "number") {
        setCreditStatus((prev) => (prev ? { ...prev, remaining: result.credits_remaining } : prev));
      }
    } catch (e) {
      setError(getCallGuardError(e, "Failed to analyze audio."));
    } finally {
      isProcessingRef.current = false;
      setAnalyzing(false);
    }
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
        text: seg.text,
        timestamp: new Date(),
        risk_level: result.risk_level,
        speaker: seg.speaker || "unknown",
        feedback: "",
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

  const resetState = () => {
    setTranscript([]);
    setWarnings([]);
    setOverallRisk("low");
    setTactics([]);
    setCoaching([]);
    setSpeakerDetectionNote("");
    setCallSeconds(0);
    transcriptRef.current = [];
    overallRiskRef.current = "low";
    reportedIndicatorsRef.current = [];
    lastSpeakerRef.current = null;
    userStoppedRef.current = false;
    hasSpeechInUtteranceRef.current = false;
  };

  const handleStart = async () => {
    setError(null);
    resetState();

    try {
      if (mode === "screen") {
        await startScreenCapture();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Your browser doesn't support audio capture.");
      if (typeof MediaRecorder === "undefined") throw new Error("Your browser doesn't support audio recording.");

      let stream;
      if (mode === "mic") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          displayStream.getTracks().forEach((t) => t.stop());
          throw new Error('No audio captured. Check "Share audio" when prompted.');
        }
        stream = new MediaStream(audioTracks);
      }

      streamRef.current = stream;
      const audioMime = getSupportedAudioMime();
      const recorder = new MediaRecorder(stream, audioMime ? { mimeType: audioMime, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 });
      recorderRef.current = recorder;

      // Each recorder stop = one complete utterance. The blob is sent for
      // batch transcription + contextual analysis. The recorder restarts
      // immediately to capture the next utterance.
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && hasSpeechInUtteranceRef.current) {
          const blobMime = e.data.type || audioMime || "audio/webm";
          processUtterance(e.data, blobMime);
        }
        hasSpeechInUtteranceRef.current = false;
      };

      recorder.onstop = () => {
        if (!userStoppedRef.current) {
          try {
            recorderRef.current.start();
            utteranceStartRef.current = Date.now();
            setIsRecording(false);
          } catch {
            stream.getTracks().forEach((t) => t.stop());
            setIsListening(false);
            setError("Recording could not continue. Tap Start to resume.");
          }
        } else {
          stream.getTracks().forEach((t) => t.stop());
          setIsListening(false);
          setIsRecording(false);
        }
      };

      recorder.start();
      utteranceStartRef.current = Date.now();

      // VAD: detect utterance boundaries using RMS energy analysis.
      // A 700ms silence while previously speaking = utterance ended.
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      let silenceStart = 0;
      let isSpeaking = false;

      const checkAudioLevel = () => {
        if (userStoppedRef.current || !analyserRef.current) return;
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const val = (data[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = Date.now();

        if (rms > SILENCE_THRESHOLD) {
          if (!isSpeaking) {
            isSpeaking = true;
            setIsRecording(true);
          }
          hasSpeechInUtteranceRef.current = true;
          silenceStart = 0;
        } else if (isSpeaking) {
          if (!silenceStart) silenceStart = now;
          if (now - silenceStart > SILENCE_DURATION_MS) {
            // Utterance boundary: 700ms of silence after speech
            isSpeaking = false;
            setIsRecording(false);
            if (recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
            }
          }
        }

        // Force-end very long utterances (12s) to avoid missing analysis
        if (now - utteranceStartRef.current > MAX_UTTERANCE_MS && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      };

      // setInterval (not rAF) keeps VAD running when the tab loses focus
      vadIntervalRef.current = setInterval(checkAudioLevel, 100);
      setIsListening(true);
      requestWakeLock();
    } catch (e) {
      const name = e?.name || "";
      const msg = e?.message || "Failed to start listening.";
      if (name === "NotReadableError" || name === "SecurityError" || /could not start|in use|not allowed|denied|permission/i.test(msg)) {
        setError("Your phone keeps the mic for the call app, so the browser can't listen in during an active call. Put the call on speakerphone and use Microphone mode on a second device, or end the call and use Upload Recording.");
      } else {
        setError(msg);
      }
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

    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    releaseWakeLock();
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; analyserRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    else setIsListening(false);
    if (screenIntervalRef.current) { clearInterval(screenIntervalRef.current); screenIntervalRef.current = null; }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; videoRef.current = null; }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setIsListening(false);
    setIsRecording(false);
    setAnalyzing(false);
  };

  const startScreenCapture = async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    streamRef.current = displayStream;

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
                <p className="text-xs text-muted-foreground">Put your call on <strong>speakerphone</strong> near the device. Live Guard detects utterance boundaries and analyzes complete conversational turns.</p>
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
                  {isRecording ? "Capturing speech..." : analyzing ? "Analyzing utterance..." : "Waiting for speech..."} · {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, "0")}
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
              {transcript.length} utterances · {warnings.length} warnings · {creditStatus?.remaining || 0} credits left
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
          <TranscriptFeed segments={transcript} onEditSegment={handleEditSegment} isRecording={isRecording} analyzing={analyzing} mode={mode} />
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