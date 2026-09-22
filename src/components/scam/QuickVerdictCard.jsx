import React from "react";
import { Phone, Globe } from "lucide-react";
import RiskBadge, { getRiskLevelFromScore, getRiskBarColor } from "@/components/scam/RiskBadge";

// Compact "quick summary verdict" card for a URL or phone number result.
// Shown when the "Detailed report" switch is OFF.
export default function QuickVerdictCard({ kind, data }) {
  const score = data?.risk_score ?? data?.reputation_score ?? 0;
  const level = data?.risk_level || getRiskLevelFromScore(score);
  const summary = data?.explanation || data?.summary || "";
  const title = kind === "phone" ? (data?.phone_number || "Phone number") : "URL";

  return (
    <div className="rounded-2xl border border-border/50 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
          {kind === "phone" ? <Phone className="w-4 h-4 flex-shrink-0" /> : <Globe className="w-4 h-4 flex-shrink-0" />}
          <span className="font-mono break-all">{title}</span>
        </div>
        <RiskBadge level={level} size="lg" />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-heading">{score}</span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${getRiskBarColor(score)}`} style={{ width: `${score}%` }} />
        </div>
      </div>
      {summary && <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>}
    </div>
  );
}