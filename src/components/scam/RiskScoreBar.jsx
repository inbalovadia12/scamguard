import React from "react";

// A horizontal risk-score bar that fills to the score (0-100).
// The fill is a green -> orange -> red gradient, so low scores show green,
// medium scores show a green->orange gradient, and high scores show the full
// green->orange->red sweep. The leading edge is colored to match the risk band.
export default function RiskScoreBar({ score, showLabel = true, className = "" }) {
  const value = Math.max(0, Math.min(100, typeof score === "number" ? Math.round(score) : 0));
  const band = value >= 71 ? "high" : value >= 36 ? "medium" : "low";
  const edgeColor = band === "high" ? "bg-destructive" : band === "medium" ? "bg-warning" : "bg-success";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Risk Score</span>
          <span className={`font-bold ${band === "high" ? "text-destructive" : band === "medium" ? "text-warning" : "text-success"}`}>{value}/100</span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-muted overflow-hidden relative">
        <div
          className="h-full rounded-full bg-gradient-to-r from-success via-warning to-destructive transition-all duration-500"
          style={{ width: `${value}%` }}
        />
        <div
          className={`absolute top-0 bottom-0 w-1 rounded-full ${edgeColor} transition-all duration-500`}
          style={{ left: `calc(${value}% - 2px)` }}
          aria-hidden
        />
      </div>
    </div>
  );
}