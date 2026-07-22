import React from "react";
import { AlertTriangle, Zap } from "lucide-react";

const LEVEL_COLORS = {
  low: "bg-success/10 text-success border-success/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function WarningPanel({ warnings, tactics }) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Warnings & Tactics</h3>
      </div>

      {tactics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tactics.map((t, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No warnings yet. Conversation seems safe.</p>
        ) : (
          warnings.map((w, i) => (
            <div
              key={i}
              className={`text-sm p-2.5 rounded-lg border ${LEVEL_COLORS[w.level] || LEVEL_COLORS.low}`}
            >
              <p className="font-medium">{w.text}</p>
              <p className="text-xs opacity-60 mt-1">
                {new Date(w.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}