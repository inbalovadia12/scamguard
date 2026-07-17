import React from "react";
import { MapPin, Signal, Users, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RISK_META } from "@/components/scam/ScamReportCard";

export default function PhoneResultView({ data }) {
  const risk = RISK_META[data.risk_level] || RISK_META.medium;
  const score = data.reputation_score || 0;
  const scoreColor = score >= 71 ? "text-destructive" : score >= 31 ? "text-warning" : "text-success";
  const barColor = score >= 71 ? "bg-destructive" : score >= 31 ? "bg-warning" : "bg-success";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm font-mono">{data.phone_number}</span>
        {data.created_date && (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(data.created_date), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Reputation score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reputation Score</span>
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {score}
            <span className="text-sm text-muted-foreground">/100</span>
          </span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${score}%` }} />
        </div>
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${risk.color}`}>
          {risk.label} Risk
        </span>
      </div>

      {/* Country & Carrier */}
      <div className="grid grid-cols-2 gap-3">
        {data.country && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> Country
            </div>
            <p className="text-sm font-medium">{data.country}</p>
          </div>
        )}
        {data.carrier && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Signal className="w-3.5 h-3.5" /> Carrier
            </div>
            <p className="text-sm font-medium">{data.carrier}</p>
          </div>
        )}
      </div>

      {/* Scam categories */}
      {data.scam_categories?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5" /> Known Scam Categories
          </div>
          <div className="flex flex-wrap gap-2">
            {data.scam_categories.map((cat, i) => (
              <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
      )}

      {/* User reports */}
      {data.user_reports?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" /> User Reports
          </div>
          <div className="space-y-2">
            {data.user_reports.map((report, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 flex-shrink-0" />
                <span className="leading-relaxed">{report}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}