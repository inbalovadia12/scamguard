import React, { useState, useEffect, useRef } from "react";
import { Radio, Phone, Monitor, Mic, Loader2, Crown, ShieldAlert, AlertTriangle, ShieldCheck, Square, Activity, Eye, Info, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { getCreditStatus, CREDIT_COSTS, incrementCreditUsage } from "@/lib/credits";
import TranscriptFeed from "@/components/call/TranscriptFeed";
import WarningPanel from "@/components/call/WarningPanel";
import AIDisclaimer from "@/components/AIDisclaimer";
import { useIsMobile } from "@/hooks/use-mobile";


const CHUNK_MS = 3000;
const SCREEN_INTERVAL_OPTIONS = [
  { label: "1 sec", ms: 1000, credits: 8 },
  { label: "3 sec", ms: 3000, credits: 5 },
  { label: "5 sec", ms: 5000, credits: 3 },
];
const RISK_ORDER = { low: 0, medium: 1, high: 2 };

function getSupportedAudioMime() {
  const types = ["audio/webm", "audio/mp4", "audio/ogg", "audio/aac"];
  for (const type of types) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch { /* isTypeSupported not available */ }
  }
  return "";
}

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "Low Risk — No Scam Detected" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Caution — Suspicious Activity" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "High Risk — Likely Scam" },
};

export default function LiveCallAnalyzer() {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState(() => {
    // Deep-link: ?mode=upload jumps straight to the "past call recording" flow (works on mobile too)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "upload") return "upload";
      if (window.matchMedia("(max-width: 767px)").matches) {
        return "mic";
      }
    }
    return "system";
  });
  const [screenInterval, setScreenInterval] = useState(SCREEN_INTERVAL_OPTIONS[2]);
  const supportsDisplayMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  // Microphone is the only mode that works on mobile browsers.
  // System Audio, Phone Call, and Screen View all rely on getDisplayMedia (desktop-only).
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [overallRisk, setOverallRisk] = useState("low");
  const [tactics, setTactics] = useState([]);
  const [coaching, setCoaching] = useState([]);
  const [error, setError] = useState(null);
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [processingChunk, setProcessingChunk] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const screenIntervalRef = useRef(null);
  const videoRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadFrameRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const chunkStartRef = useRef(0);
  const userStoppedRef = useRef(false);
  const chunkQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef([]);
  const overallRiskRef = useRef("low");

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

  // On mobile, only Microphone mode works — auto-switch away from desktop-only modes
  useEffect(() => {
    if (isMobile && mode !== "mic" && mode !== "upload") {
      setMode("mic");
    }
  }, [isMobile]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleEditSegment = async (index, updates) => {
    setTranscript((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    transcriptRef.current = transcriptRef.current.map((t, i) =>
      i === index ? { ...t, ...updates } : t
    );

    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const langName = { en: "English", he: "Hebrew", es: "Spanish" }[lang] || "English";
      const context = transcriptRef.current.slice(-4).map((t) => `${t.speaker}: ${t.text}`).join("\n");
      const speakerRole = updates.speaker === "victim" ? "the app user being protected" : "the other party / potential scammer";
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a scam prevention coach on a live phone call. Analyze this corrected transcript segment:\nSpeaker: ${updates.speaker} (${speakerRole})\nText: "${updates.text}"\nRecent context: ${context}\n\nIf speaker is "victim": give brief actionable advice (1-2 sentences) — are they sharing sensitive info? Should they hang up? Are they handling it well?\nIf speaker is "scammer": briefly note what manipulation tactic they're using (1 sentence).\nRespond in ${langName}.`,
        response_json_schema: { type: "object", properties: { feedback: { type: "string" } } },
      });
      const newFeedback = result.feedback || "";
      setTranscript((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], feedback: newFeedback };
        return next;
      });
      transcriptRef.current[index].feedback = newFeedback;
    } catch {
      // Keep old feedback if regeneration fails
    }
  };

  // Keep the screen awake while on a speakerphone call so analysis isn't paused
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      // Wake lock not supported or denied — analysis still works, screen may turn off
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Shared mapping of an analyzeCallChunk result into the transcript/warnings/risk UI
  const populateResult = (result) => {
    if (result.segments?.length) {
      const newSegs = result.segments.map((seg) => ({
        text: seg.text,
        timestamp: new Date(),
        risk_level: result.risk_level,
        speaker: seg.speaker || "unknown",
        feedback: seg.speaker === "victim" ? (result.feedback || "") : "",
      }));
      setTranscript((prev) => [...prev, ...newSegs]);
      transcriptRef.current = [...transcriptRef.current, ...newSegs];
    } else if (result.transcript) {
      const newSeg = { text: result.transcript, timestamp: new Date(), risk_level: result.risk_level, speaker: result.speaker || "unknown", feedback: result.feedback || "" };
      setTranscript((prev) => [...prev, newSeg]);
      transcriptRef.current = [...transcriptRef.current, newSeg];
    }
    if (result.feedback) {
      setCoaching((prev) => [{ text: result.feedback, timestamp: new Date(), risk_level: result.risk_level }, ...prev]);
    }
    const warningsArr = Array.isArray(result.warnings) ? result.warnings : [];
    if (warningsArr.length) {
      setWarnings((prev) => [...warningsArr.map((w) => ({ text: w, timestamp: new Date(), level: result.risk_level })), ...prev]);
    }
    if (RISK_ORDER[result.risk_level] > RISK_ORDER[overallRiskRef.current]) {
      overallRiskRef.current = result.risk_level;
      setOverallRisk(result.risk_level);
    }
    const tacticsArr = Array.isArray(result.tactics_detected) ? result.tactics_detected : [];
    if (tacticsArr.length) {
      setTactics((prev) => {
        const set = new Set(prev);
        tacticsArr.forEach((t) => set.add(t));
        return [...set];
      });
    }
  };

  // Replacement path when live mic capture is blocked by an active phone call:
  // the user records the call with their phone's call recorder, then uploads the audio.
  const analyzeUploadedRecording = async (file) => {
    setError(null);
    setTranscript([]);
    setWarnings([]);
    setOverallRisk("low");
    setTactics([]);
    setCoaching([]);
    transcriptRef.current = [];
    overallRiskRef.current = "low";
    setUploading(true);
    try {
      if (!file.type.startsWith("audio/")) {
        throw new Error("Please choose an audio file (m4a, mp3, wav, etc.).");
      }
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("analyzeCallChunk", {
        audio_url: uploadRes.file_url,
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      const result = response.data;
      if (!result.transcript && !result.segments?.length) {
        setError("Couldn't transcribe this recording. Try a clearer or shorter recording.");
      } else {
        populateResult(result);
      }
      base44.entities.LiveGuardSession.create({
        session_type: "uploaded_recording",
        overall_risk: overallRiskRef.current,
        tactics_detected: result.tactics_detected || [],
        warnings: result.warnings || [],
        transcript: JSON.stringify((result.segments || []).map((s) => ({ text: s.text, risk_level: result.risk_level, speaker: s.speaker }))),
        segment_count: result.segments?.length || (result.transcript ? 1 : 0),
      }).catch(() => {});
      await incrementCreditUsage(CREDIT_COSTS.CALL_CHUNK);
      setCreditStatus(await getCreditStatus());
    } catch (e) {
      setError(e.message || "Failed to analyze recording.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStart = async () => {
    setError(null);
    setTranscript([]);
    setWarnings([]);
    setOverallRisk("low");
    setTactics([]);
    setCoaching([]);
    setCallSeconds(0);
    transcriptRef.current = [];
    overallRiskRef.current = "low";
    chunkQueueRef.current = [];
    userStoppedRef.current = false;

    try {
      if (mode === "screen") {
        await startScreenCapture();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser doesn't support audio capture. Try updating your browser.");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Your browser doesn't support audio recording. Try updating your browser.");
      }

      let stream;
      if (mode === "mic") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          displayStream.getTracks().forEach((t) => t.stop());
          throw new Error('No audio captured. Make sure to check "Share audio" / "Share system audio" when prompted.');
        }
        stream = new MediaStream(audioTracks);
      }

      streamRef.current = stream;
      const audioMime = getSupportedAudioMime();
      const recorder = new MediaRecorder(stream, audioMime ? { mimeType: audioMime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
      recorderRef.current = recorder;

      const processNextChunk = async () => {
        if (isProcessingRef.current || chunkQueueRef.current.length === 0) return;
        isProcessingRef.current = true;
        setProcessingChunk(true);
        setError(null);

        try {
          const blob = chunkQueueRef.current.shift();
          const blobMime = blob.type || audioMime || "audio/webm";

          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });

          const lang = localStorage.getItem("vardin_language") || "en";
          const recentContext = transcriptRef.current.slice(-6).map((t) => `${t.speaker}: ${t.text}`).join("\n");
          const speakerHistory = transcriptRef.current.slice(-8).map((t) => t.speaker).filter(Boolean).join(",");

          const response = await base44.functions.invoke("analyzeCallChunk", {
            audio_base64: base64,
            audio_mime: blobMime,
            language: lang,
            session_context: recentContext,
            speaker_history: speakerHistory,
          });

          if (response.data?.error) throw new Error(response.data.error);
          const result = response.data;

          populateResult(result);

          incrementCreditUsage(CREDIT_COSTS.CALL_CHUNK)
            .then(() => getCreditStatus())
            .then(setCreditStatus)
            .catch(() => {});
        } catch (e) {
          setError(e.message || "Failed to analyze audio chunk.");
        } finally {
          isProcessingRef.current = false;
          setProcessingChunk(false);
          if (chunkQueueRef.current.length > 0) {
            processNextChunk();
          }
        }
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // Drop stale chunks when backed up — keeps feedback real-time
          if (chunkQueueRef.current.length > 0) {
            chunkQueueRef.current = [e.data];
          } else {
            chunkQueueRef.current.push(e.data);
          }
          processNextChunk();
        }
      };

      recorder.onstop = () => {
        if (!userStoppedRef.current) {
          try {
            recorderRef.current.start();
            chunkStartRef.current = Date.now();
          } catch (e) {
            stream.getTracks().forEach((t) => t.stop());
            setIsListening(false);
            setError("Recording could not continue. Tap Start to resume.");
          }
        } else {
          stream.getTracks().forEach((t) => t.stop());
          if (chunkIntervalRef.current) {
            clearInterval(chunkIntervalRef.current);
            chunkIntervalRef.current = null;
          }
          setIsListening(false);
        }
      };

      recorder.start();
      chunkStartRef.current = Date.now();

      // VAD: split chunks at natural pauses instead of fixed timer
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      let silenceStart = 0;
      let isSpeaking = false;
      const SILENCE_THRESHOLD = 0.015;
      const SILENCE_DURATION = 350;
      const MAX_CHUNK_MS = 4500;

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
          isSpeaking = true;
          silenceStart = 0;
        } else if (isSpeaking) {
          if (!silenceStart) silenceStart = now;
          if (now - silenceStart > SILENCE_DURATION) {
            isSpeaking = false;
            if (recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
            }
          }
        }

        if (now - chunkStartRef.current > MAX_CHUNK_MS && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      };
      // setInterval (not requestAnimationFrame) keeps VAD running when the tab
      // loses focus during a phone call — rAF pauses entirely on hidden tabs.
      vadIntervalRef.current = setInterval(checkAudioLevel, 200);
      setIsListening(true);
      requestWakeLock();
    } catch (e) {
      const name = e?.name || "";
      const msg = e?.message || "Failed to start listening.";
      if (name === "NotReadableError" || name === "SecurityError" || /could not start|in use|not allowed|denied|permission/i.test(msg)) {
        setError("Your phone keeps the mic for the call app, so the browser can't listen in during an active call. For real-time warnings, put the call on speakerphone and run Vardin's Microphone mode on a second device. Otherwise, end the call and use \"Upload Recording\" to analyze a recording of it.");
      } else {
        setError(msg);
      }
    }
  };

  const handleStop = () => {
    userStoppedRef.current = true;

    // Save session record
    if (transcript.length > 0 || warnings.length > 0) {
      const sessionType = mode === "mic" ? "microphone" : mode === "screen" ? "screen_view" : "system_audio";
      base44.entities.LiveGuardSession.create({
        session_type: sessionType,
        overall_risk: overallRisk,
        tactics_detected: tactics,
        warnings: warnings.map((w) => w.text),
        transcript: JSON.stringify(transcript.map((t) => ({
          text: t.text,
          risk_level: t.risk_level,
          speaker: t.speaker,
        }))),
        duration_seconds: callSeconds,
        segment_count: transcript.length,
      }).catch(() => {});
    }

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    releaseWakeLock();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      setIsListening(false);
    }
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsListening(false);
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

    displayStream.getVideoTracks()[0].onended = () => {
      handleStop();
    };

    const captureFrame = async () => {
      if (isProcessingRef.current) return;
      if (!video.videoWidth || !video.videoHeight) return;
      isProcessingRef.current = true;
      setProcessingChunk(true);

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
        if (!blob) throw new Error("Failed to capture screen frame.");
        const imageFile = new File([blob], `screen-${Date.now()}.jpg`, { type: "image/jpeg" });
        const uploadRes = await base44.integrations.Core.UploadFile({ file: imageFile });

        const lang = localStorage.getItem("vardin_language") || "en";
        const recentContext = transcriptRef.current.slice(-3).map((t) => t.text).join(" ");

        const response = await base44.functions.invoke("analyzeScreenCapture", {
          image_url: uploadRes.file_url,
          language: lang,
          session_context: recentContext,
        });

        if (response.data?.error) throw new Error(response.data.error);
        const result = response.data;

        const newSeg = { text: result.analysis || "Screen analyzed", timestamp: new Date(), risk_level: result.risk_level };
        setTranscript((prev) => [...prev, newSeg]);
        transcriptRef.current = [...transcriptRef.current, newSeg];

        const warningsArr = Array.isArray(result.warnings) ? result.warnings : [];
        if (warningsArr.length) {
          setWarnings((prev) => [
            ...warningsArr.map((w) => ({ text: w, timestamp: new Date(), level: result.risk_level })),
            ...prev,
          ]);
        }

        if (RISK_ORDER[result.risk_level] > RISK_ORDER[overallRiskRef.current]) {
          overallRiskRef.current = result.risk_level;
          setOverallRisk(result.risk_level);
        }

        const tacticsArr = Array.isArray(result.tactics_detected) ? result.tactics_detected : [];
        if (tacticsArr.length) {
          setTactics((prev) => {
            const set = new Set(prev);
            tacticsArr.forEach((t) => set.add(t));
            return [...set];
          });
        }

        await incrementCreditUsage(screenInterval.credits);
        setCreditStatus(await getCreditStatus());
      } catch (e) {
        setError(e.message || "Failed to analyze screen capture.");
      } finally {
        isProcessingRef.current = false;
        setProcessingChunk(false);
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
        <div className="bg-card rounded-2xl border border-border/50 p-8 sm:p-10 text-center space-y-5 animate-slide-up flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Radio className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-heading">Live Guard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time scam detection during calls, meetings, and on-screen messages. Get instant warnings as scam tactics are detected.
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
    <div className="max-w-4xl mx-auto space-y-6 pb-16">


      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        {!isListening ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Choose audio source:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setMode("mic")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  mode === "mic" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Mic className={`w-6 h-6 ${mode === "mic" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Microphone</span>
                <span className="text-xs text-muted-foreground">Speakerphone</span>
              </button>
              <button
                onClick={() => !isMobile && setMode("system")}
                disabled={isMobile}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isMobile ? "opacity-40 cursor-not-allowed border-border/30" : mode === "system" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Monitor className={`w-6 h-6 ${mode === "system" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">System Audio</span>
                <span className="text-xs text-muted-foreground">{isMobile ? "Desktop only" : "Zoom, Teams, browser"}</span>
              </button>
              <button
                onClick={() => !isMobile && setMode("phone_call")}
                disabled={isMobile}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isMobile ? "opacity-40 cursor-not-allowed border-border/30" : mode === "phone_call" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Phone className={`w-6 h-6 ${mode === "phone_call" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Phone Call</span>
                <span className="text-xs text-muted-foreground">{isMobile ? "Desktop only" : "VoIP & device calls"}</span>
              </button>
              <button
                onClick={() => !isMobile && setMode("screen")}
                disabled={isMobile}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isMobile ? "opacity-40 cursor-not-allowed border-border/30" : mode === "screen" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Eye className={`w-6 h-6 ${mode === "screen" && !isMobile ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Screen View</span>
                <span className="text-xs text-muted-foreground">{isMobile ? "Desktop only" : "SMS, WhatsApp, Email"}</span>
              </button>
              <button
                onClick={() => setMode("upload")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  mode === "upload" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Upload className={`w-6 h-6 ${mode === "upload" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Upload Recording</span>
                <span className="text-xs text-muted-foreground">Recorded call audio</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyzeUploadedRecording(f);
              }}
            />
            {mode === "mic" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Mic className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Put your call on <strong>speakerphone</strong> and place the phone near the speaker. Live Guard will analyze the conversation in real time.
                </p>
              </div>
            )}
            {(mode === "system" || mode === "phone_call") && (
              supportsDisplayMedia ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Phone className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {mode === "phone_call"
                      ? "Start your call first (Zoom, Teams, Skype, or device call on Android), then tap Start. When prompted, share your system audio."
                      : 'When prompted, share a tab or your entire screen and make sure to check "Share audio".'}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    System audio capture isn't available on this browser. iOS doesn't allow web apps to capture other apps' audio. Use <strong>Microphone</strong> mode instead, or try Chrome on Android or desktop.
                  </p>
                </div>
              )
            )}
            {mode === "upload" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Upload className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Record your call using your phone's built-in call recorder (where legal), then choose the audio file here. Vardin transcribes and analyzes the whole conversation. Best with recordings under a few minutes.
                </p>
              </div>
            )}
            <Button
              onClick={mode === "upload" ? () => fileInputRef.current?.click() : handleStart}
              className="w-full gap-2 h-12"
              disabled={uploading || !creditStatus?.canAnalyze || ((mode === "system" || mode === "phone_call") && !supportsDisplayMedia)}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "screen" ? <Eye className="w-4 h-4" /> : mode === "upload" ? <Upload className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              {uploading ? "Analyzing recording..." : mode === "screen" ? "Start Watching" : mode === "upload" ? "Choose Recording" : mode === "phone_call" ? "Start Call Guard" : "Start Listening"}
            </Button>
            {mode === "screen" && !isMobile && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground">Capture every:</span>
                  {SCREEN_INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setScreenInterval(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        screenInterval.label === opt.label
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {opt.label} · {opt.credits} cr
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Microphone works on all devices. System Audio & Phone Call capture other apps' audio on Chrome/Edge (desktop & Android). iOS doesn't support system audio capture.
            </p>
            {!creditStatus?.canAnalyze && (
              <p className="text-xs text-warning text-center">You're out of AI credits for this month.</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-destructive animate-ping" />
              </div>
              <div>
                <p className="text-sm font-semibold">{mode === "screen" ? "Watching Screen" : mode === "phone_call" ? "Guarding Phone Call" : mode === "mic" ? "Listening via Microphone" : "Listening via System Audio"}</p>
                <p className="text-xs text-muted-foreground">
                  {processingChunk ? "Analyzing..." : mode === "screen" ? "Capturing screen..." : "Capturing audio..."} • {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, "0")}
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={handleStop} className="gap-2">
              <Square className="w-4 h-4" />
              Stop
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
        <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-4 flex items-center gap-3 animate-slide-up`}>
          <RiskIcon className={`w-6 h-6 ${cfg.color}`} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
            <p className="text-xs text-muted-foreground">
              {transcript.length} segments • {warnings.length} warnings • {creditStatus?.remaining || 0} credits left
            </p>
          </div>
          {tactics.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1.5 justify-end max-w-[40%]">
              {tactics.slice(0, 3).map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <AIDisclaimer />

      {(transcript.length > 0 || warnings.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          <TranscriptFeed segments={transcript} onEditSegment={handleEditSegment} />
          <WarningPanel warnings={warnings} tactics={tactics} coaching={coaching} />
        </div>
      )}

      {!isListening && transcript.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Select an audio source or screen view to get real-time scam analysis.
          </p>
        </div>
      )}
    </div>
  );
}