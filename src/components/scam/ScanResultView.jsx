import React from "react";
import { MapPin, TrendingUp, Phone, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import SeasonalCalendar from "@/components/scam/SeasonalCalendar";
import { RISK_META } from "@/components/scam/ScamReportCard";

export default function ScanResultView({ data }) {
  const risk = RISK_META[data.risk_level] || RISK_META.medium;
  const scams = Array.isArray(data.common_scams) ? data.common_scams : [];
  const hasPeakMonths = scams.some((s) => s.peak_months?.length);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm truncate">{data.location_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {data.created_date && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {formatDistanceToNow(new Date(data.created_date), { addSuffix: true })}
            </span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${risk.color}`}>
            {risk.label}
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>

      {data.current_trends && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <TrendingUp className="w-3.5 h-3.5" />
            Current Trends
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{data.current_trends}</p>
        </div>
      )}

      {hasPeakMonths && (
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            Seasonal Patterns
          </div>
          <SeasonalCalendar scams={scams} />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Common Scams</p>
        {scams.map((scam, i) => (
          <div key={i} className="bg-muted/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{scam.name}</span>
              {scam.peak_season && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                  {scam.peak_season}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{scam.description}</p>
          </div>
        ))}
      </div>

      {data.local_resources?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Local Resources</p>
          <div className="space-y-1.5">
            {data.local_resources.map((resource, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary/60" />
                <span className="leading-relaxed">{resource}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.seasonal_patterns?.length > 0 && !hasPeakMonths && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seasonal Patterns</p>
          <ul className="space-y-1">
            {data.seasonal_patterns.map((pattern, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary/60" />
                <span>{pattern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}