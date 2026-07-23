import React, { useEffect, useRef } from "react";
import { MessageSquare, User, AlertTriangle, ThumbsUp, ThumbsDown, Lightbulb } from "lucide-react";
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

export default function TranscriptFeed({ segments }) {
  const scrollRef = useRef(null);

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
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {segments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Waiting for speech...</p>
        ) : (
          segments.map((seg, i) => {
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
                  </div>
                  <p className="text-foreground">{seg.text}</p>
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