import React, { useState, useEffect, useRef } from "react";
import { Radio, Mic, Monitor, Loader2, Crown, ShieldAlert, AlertTriangle, ShieldCheck, Square, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { getCreditStatus, CREDIT_COSTS, incrementCreditUsage } from "@/lib/credits";
import TranscriptFeed from "@/components/call/TranscriptFeed";
import WarningPanel from "@/components/call/WarningPanel";
import AIDisclaimer from "@/components/AIDisclaimer";

const CHUNK_MS = 5000;
const RISK_ORDER = { low: 0, medium: 1, high: 2 };

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "No Threats Detected" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Caution — Suspicious Activity" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "High Risk — Likely Scam" },
};

export default function LiveCallAnalyzer() {
  const [mode, setMode] = useState("mic");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [overallRisk, setOverallRisk] = useState("low");
  const [tactics, setTactics] = useState([]);
  const [error, setError] = useState(null);
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [processingChunk, setProcessingChunk] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
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
    const init = async () => {
      const status = await getCreditStatus();
      setCreditStatus(status);
      setCheckingPlan(false);
    };
    init();
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    setTranscript([]);
    setWarnings([]);
    setOverallRisk("low");
    setTactics([]);
    setCallSeconds(0);
    transcriptRef.current = [];
    overallRiskRef.current = "low";
    chunkQueueRef.current = [];

    try {
      let stream;
      if (mode === "mic") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          displayStream.getTracks().forEach((t) => t.stop());
          throw new Error('No audio captured. Make sure to check "Share audio" when sharing your screen.');
        }
        displayStream.getVideoTracks().forEach((t) => t.stop());
        stream = new MediaStream(audioTracks);
      }

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      const processNextChunk = async () => {
        if (isProcessingRef.current || chunkQueueRef.current.length === 0) return;
        isProcessingRef.current = true;
        setProcessingChunk(true);

        try {
          const blob = chunkQueueRef.current.shift();
          const audioFile = new File([blob], `chunk-${Date.now()}.webm`, { type: "audio/webm" });
          const uploadRes = await base44.integrations.Core.UploadFile({ file: audioFile });

          const lang = localStorage.getItem("vardin_language") || "en";
          const recentContext = transcriptRef.current.slice(-3).map((t) => t.text).join(" ");

          const response = await base44.functions.invoke("analyzeCallChunk", {
            audio_url: uploadRes.file_url,
            language: lang,
            session_context: recentContext,
          });

          if (response.data?.error) throw new Error(response.data.error);
          const result = response.data;

          if (result.transcript) {
            const newSeg = { text: result.transcript, timestamp: new Date(), risk_level: result.risk_level };
            setTranscript((prev) => [...prev, newSeg]);
            transcriptRef.current = [...transcriptRef.current, newSeg];
          }

          if (result.warnings?.length) {
            setWarnings((prev) => [
              ...result.warnings.map((w) => ({ text: w, timestamp: new Date(), level: result.risk_level })),
              ...prev,
            ]);
          }

          if (RISK_ORDER[result.risk_level] > RISK_ORDER[overallRiskRef.current]) {
            overallRiskRef.current = result.risk_level;
            setOverallRisk(result.risk_level);
          }

          if (result.tactics_detected?.length) {
            setTactics((prev) => {
              const set = new Set(prev);
              result.tactics_detected.forEach((t) => set.add(t));
              return [...set];
            });
          }

          await incrementCreditUsage(CREDIT_COSTS.CALL_CHUNK);
          setCreditStatus(await getCreditStatus());
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
          chunkQueueRef.current.push(e.data);
          processNextChunk();
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(CHUNK_MS);
      setIsListening(true);
    } catch (e) {
      setError(e.message || "Failed to start listening.");
    }
  };

  const handleStop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsListening(false);
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
            Real-time scam detection during calls and meetings. Get instant warnings as scam tactics are detected.
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Radio className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Live Guard</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Real-time scam detection during calls and meetings. AI analyzes the conversation and warns you of red flags as they happen.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        {!isListening ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Choose audio source:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("mic")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  mode === "mic" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Mic className={`w-6 h-6 ${mode === "mic" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Microphone</span>
                <span className="text-xs text-muted-foreground">Phone calls via speaker</span>
              </button>
              <button
                onClick={() => setMode("system")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  mode === "system" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                }`}
              >
                <Monitor className={`w-6 h-6 ${mode === "system" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">System Audio</span>
                <span className="text-xs text-muted-foreground">Teams, Zoom, Meet</span>
              </button>
            </div>
            <Button onClick={handleStart} className="w-full gap-2 h-12" disabled={!creditStatus?.canAnalyze}>
              <Radio className="w-4 h-4" />
              Start Listening
            </Button>
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
                <p className="text-sm font-semibold">Listening via {mode === "mic" ? "Microphone" : "System Audio"}</p>
                <p className="text-xs text-muted-foreground">
                  {processingChunk ? "Analyzing..." : "Capturing audio..."} • {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, "0")}
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
          <TranscriptFeed segments={transcript} />
          <WarningPanel warnings={warnings} tactics={tactics} />
        </div>
      )}

      {!isListening && transcript.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Select an audio source and start listening to get real-time scam analysis.
          </p>
        </div>
      )}
    </div>
  );
}