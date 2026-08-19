import React, { useState } from "react";
import { Phone, Clock, ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const VERDICT_CONFIG = {
  SAFE: { color: "bg-success/10 text-success border-success/20", label: "SAFE" },
  SUSPICIOUS: { color: "bg-warning/10 text-warning border-warning/20", label: "SUSPICIOUS" },
  SCAM: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "SCAM" },
};

function formatPhone(digits) {
  if (!digits) return "Unknown number";
  const d = digits.replace(/[^\d]/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecentCallsList({ reports, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reports : reports.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          <h2 className="font-semibold font-heading">Recent Calls</h2>
        </div>
        {reports.length > 0 && (
          <span className="text-xs text-muted-foreground">{reports.length} call{reports.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Inbox className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No calls screened yet</p>
            <p className="text-xs text-muted-foreground mt-1">Call reports will appear here once Call Guard screens your first call.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((report) => {
            const verdict = VERDICT_CONFIG[report.vardin_verdict] || VERDICT_CONFIG.SAFE;
            return (
              <button
                key={report.id}
                onClick={() => onSelect(report)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border transition-all text-left group"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {report.caller_phone_number ? formatPhone(report.caller_phone_number) : "Unknown caller"}
                    </span>
                    {report.caller_name && (
                      <span className="text-xs text-muted-foreground">— {report.caller_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(report.assessed_at || report.created_date)}
                    </span>
                  </div>
                  {report.vardin_explanation && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {report.vardin_explanation}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${verdict.color}`}>
                    {verdict.label}
                  </span>
                  {report.confidence_score > 0 && (
                    <span className="text-[10px] text-muted-foreground">{report.confidence_score}% conf.</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}

          {reports.length > 5 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-center py-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Show all {reports.length} calls
            </button>
          )}
        </div>
      )}
    </div>
  );
}