import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, User, AlertTriangle, ThumbsUp, Lightbulb, Pencil, Check, X, Activity } from "lucide-react";
import { getFeedbackSentiment } from "./feedbackUtils";

const SPEAKER_CONFIG = {
  you: { label: "You", icon: User, color: "text-primary", bg: "bg-primary/10" },
  caller: { label: "Caller", icon: MessageSquare, color: "text-foreground", bg: "bg-muted/50" },
  unknown: { label: "Unknown", icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted/50" },
  victim: { label: "You", icon: User, color: "text-primary", bg: "bg-primary/10" },
  scammer: { label: "Caller", icon: MessageSquare, color: "text-destructive", bg: "bg-destructive/10" },
  speaker: { label: "Speaker", icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted/50" },
};

const SPEAKER_OPTIONS = [
  { value: "caller", label: "Caller" },
  { value: "you", label: "You" },
];

export default function TranscriptFeed({ segments, onEditSegment, onSwapLastSpeakers, isRecording, analyzing, mode, partialText }) {
  const scrollRef = useRef(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [editSpeaker, setEditSpeaker] = useState("unknown");

  const startEdit = (i) => {
    setEditingIndex(i);
    setEditText(segments[i].text);
    const speaker = segments[i].speaker;
    setEditSpeaker(speaker === "you" || speaker === "victim" ? "you" : "caller");
  };
  const saveEdit = () => {
    if (editingIndex !== null && onEditSegment && editText.trim()) {
      onEditSegment(editingIndex, { text: editText.trim(), speaker: editSpeaker });
    }
    setEditingIndex(null);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segments, isRecording, analyzing, partialText]);

  const showListening = (isRecording || analyzing) && mode !== "screen";

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 flex flex-col h-[340px] sm:h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Live Transcript</h3>
        <span className="text-xs text-muted-foreground ml-auto">Tap to edit · Double-click to swap speakers</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1" onDoubleClick={() => onSwapLastSpeakers?.()}>
        {segments.length === 0 && !showListening ? (
          <p className="text-sm text-muted-foreground text-center py-8">Waiting for speech...</p>
        ) : (
          segments.map((seg, i) => {
            if (editingIndex === i) {
              return (
                <div key={i} className="flex flex-col items-start" onDoubleClick={(e) => e.stopPropagation()}>
                  <div className="text-sm p-2.5 rounded-2xl max-w-[90%] w-full bg-muted/30 rounded-bl-sm space-y-2 border border-primary/30">
                    <select value={editSpeaker} onChange={(e) => setEditSpeaker(e.target.value)} className="text-xs px-2 py-1 rounded-lg bg-background border border-border">
                      {SPEAKER_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus rows={2} className="w-full text-sm p-2 rounded-lg bg-background border border-border resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                    <div className="flex gap-1.5">
                      <button onClick={saveEdit} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-success text-success-foreground font-medium"><Check className="w-3 h-3" /> Save</button>
                      <button onClick={() => setEditingIndex(null)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium"><X className="w-3 h-3" /> Cancel</button>
                    </div>
                  </div>
                </div>
              );
            }
            const isYou = seg.speaker === "you" || seg.speaker === "victim";
            const isHighRisk = seg.risk_level === "high";
            const cfg = SPEAKER_CONFIG[seg.speaker] || SPEAKER_CONFIG.unknown;
            const SpeakerIcon = isHighRisk && !isYou ? AlertTriangle : cfg.icon;
            const sentiment = getFeedbackSentiment(seg.feedback);
            const fbStyle = sentiment === "positive" ? { icon: ThumbsUp, color: "text-success" } : sentiment === "warning" ? { icon: AlertTriangle, color: "text-destructive" } : { icon: Lightbulb, color: "text-muted-foreground" };
            const FeedbackIcon = fbStyle.icon;
            return (
              <div key={i} className={`flex flex-col ${isYou ? "items-end" : "items-start"}`} onDoubleClick={(e) => e.stopPropagation()}>
                <div className={`text-sm p-2.5 rounded-2xl max-w-[85%] ${isYou ? "bg-primary/5 rounded-br-sm" : isHighRisk ? "bg-destructive/5 rounded-bl-sm border border-destructive/20" : "bg-muted/30 rounded-bl-sm"}`}>
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${cfg.bg} ${isHighRisk && !isYou ? "text-destructive" : cfg.color} text-xs font-medium mb-1.5`}>
                    <SpeakerIcon className="w-3 h-3" />
                    {cfg.label}
                    <Pencil className="w-2.5 h-2.5 ml-0.5 opacity-40" />
                  </div>
                  <p className="text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => startEdit(i)}>{seg.text}</p>
                  {seg.feedback && (
                    <div className={`mt-2 flex items-start gap-1.5 p-2 rounded-lg ${isYou ? "bg-primary/5" : "bg-muted/40"}`}>
                      <FeedbackIcon className={`w-3.5 h-3.5 ${fbStyle.color} flex-shrink-0 mt-0.5`} />
                      <p className={`text-xs ${fbStyle.color} font-medium`}>{seg.feedback}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(seg.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            );
          })
        )}
        {showListening && (
          <div className="flex flex-col items-start" onDoubleClick={(e) => e.stopPropagation()}>
            {partialText ? (
              <div className="text-sm p-2.5 rounded-2xl max-w-[85%] bg-muted/30 rounded-bl-sm">
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground text-xs font-medium mb-1.5">
                  <Activity className="w-3 h-3" />
                  Speaking…
                </div>
                <p className="text-muted-foreground italic">{partialText}</p>
              </div>
            ) : (
              <div className="text-sm p-2.5 rounded-2xl bg-muted/20 rounded-bl-sm border border-border/30">
                <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground text-xs font-medium mb-1.5">
                  <Activity className="w-3 h-3" />
                  {analyzing ? "Analyzing..." : "Listening..."}
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}