import React, { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

const RISK_COLORS = {
  low: "border-l-success",
  medium: "border-l-warning",
  high: "border-l-destructive",
};

export default function TranscriptFeed({ segments }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Live Transcript</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {segments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Waiting for speech...</p>
        ) : (
          segments.map((seg, i) => (
            <div
              key={i}
              className={`text-sm p-2.5 rounded-lg bg-muted/30 border-l-2 ${RISK_COLORS[seg.risk_level] || RISK_COLORS.low}`}
            >
              <p className="text-foreground">{seg.text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(seg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}