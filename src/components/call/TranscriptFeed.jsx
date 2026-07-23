import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, User, AlertTriangle, ThumbsUp, ThumbsDown, Lightbulb, Pencil, Check, X } from "lucide-react";
import { getFeedbackSentiment } from "./feedbackUtils";

const RISK_COLORS = {
  low: "border-l-success",
  medium: "border-l-warning",
  high: "border-l-destructive",
};

const SPEAKER_CONFIG = {
  scammer: { label: "Scammer", icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  victim: { label: "You", icon: User, color: "text-primary", bg: "bg-primary/10" },
  unknown: { label: "Speaker", icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted/50" },
};

const FEEDBACK_STYLES = {
  positive: { icon: ThumbsUp, color: "text-success", bg: "bg-success/5" },
  warning: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/5" },
  neutral: { icon: Lightbulb, color: "text-muted-foreground", bg: "bg-muted/40" },
};

const SPEAKER_OPTIONS = [
  { value: "scammer", label: "Scammer" },
  { value: "victim", label: "You" },
  { value: "unknown", label: "Speaker" },
];

export default function TranscriptFeed({ segments, onEditSegment }) {
  const scrollRef = useRef(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [editSpeaker, setEditSpeaker] = useState("unknown");

  const startEdit = (i) => {
    setEditingIndex(i);
    setEditText(segments[i].text);
    setEditSpeaker(segments[i].speaker || "unknown");
  };
  const saveEdit = () => {
    if (editingIndex !== null && onEditSegment && editText.trim()) {
      onEditSegment(editingIndex, { text: editText.trim(), speaker: editSpeaker });
    }
    setEditingIndex(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 flex flex-col h-[340px] sm:h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Live Transcript</h3>
        <span className="text-xs text-muted-foreground ml-auto">Tap text to edit</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {segments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Waiting for speech...</p>
        ) : (
          segments.map((seg, i) => {
            if (editingIndex === i) {
              return (
                <div key={i} className="flex flex-col items-start">
                  <div className="text-sm p-2.5 rounded-2xl border-l-2 max-w-[90%] w-full bg-muted/30 rounded-bl-sm border-l-primary space-y-2">
                    <select
                      value={editSpeaker}
                      onChange={(e) => setEditSpeaker(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg bg-background border border-border"
                    >
                      {SPEAKER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                      rows={2}
                      className="w-full text-sm p-2 rounded-lg bg-background border border-border resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-1.5">
                      <button onClick={saveEdit} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-success text-success-foreground font-medium">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditingIndex(null)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            const cfg = SPEAKER_CONFIG[seg.speaker] || SPEAKER_CONFIG.unknown;
            const SpeakerIcon = cfg.icon;
            const isVictim = seg.speaker === "victim";
            const sentiment = getFeedbackSentiment(seg.feedback);
            const fbStyle = FEEDBACK_STYLES[sentiment];
            const FeedbackIcon = fbStyle.icon;
            const feedbackColor = fbStyle.color;
            return (
              <div
                key={i}
                className={`flex flex-col ${isVictim ? "items-end" : "items-start"}`}
              >
                <div className={`text-sm p-2.5 rounded-2xl border-l-2 max-w-[85%] ${isVictim ? "bg-primary/5 rounded-br-sm" : "bg-muted/30 rounded-bl-sm"} ${RISK_COLORS[seg.risk_level] || RISK_COLORS.low}`}>
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} text-xs font-medium mb-1.5`}>
                    <SpeakerIcon className="w-3 h-3" />
                    {cfg.label}
                    <Pencil className="w-2.5 h-2.5 ml-0.5 opacity-40" />
                  </div>
                  <p className="text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => startEdit(i)}>{seg.text}</p>
                  {seg.feedback && (
                    <div className={`mt-2 flex items-start gap-1.5 p-2 rounded-lg ${isVictim ? "bg-primary/5" : "bg-muted/40"}`}>
                      <FeedbackIcon className={`w-3.5 h-3.5 ${feedbackColor} flex-shrink-0 mt-0.5`} />
                      <p className={`text-xs ${feedbackColor} font-medium`}>{seg.feedback}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(seg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}