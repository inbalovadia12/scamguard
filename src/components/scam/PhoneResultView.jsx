import React, { useState } from "react";
import { MapPin, Signal, Users, Tag, ExternalLink, BadgeCheck, Activity, Flag, ShieldCheck } from "lucide-react";
import { RISK_META } from "@/components/scam/ScamReportCard";
import CommunityIntel, { matchCategoriesToEnum } from "@/components/community/CommunityIntel";
import ReportScamDialog from "@/components/scam/ReportScamDialog";
import { Button } from "@/components/ui/button";

const STATUS_META = {
  SCAM: { label: "Scam Likely", color: "bg-destructive/10 text-destructive border-destructive/30" },
  SPAM: { label: "Spam", color: "bg-warning/10 text-warning border-warning/30" },
  SUSPICIOUS: { label: "Suspicious", color: "bg-warning/10 text-warning border-warning/30" },
  SAFE: { label: "No Known Risk Found", color: "bg-success/10 text-success border-success/30" },
  UNKNOWN: { label: "No Known Risk Found", color: "bg-muted text-muted-foreground border-border/50" },
};

export default function PhoneResultView({ data }) {
  const [reportOpen, setReportOpen] = useState(false);

  const checkWithMalwarebytes = async () => {
    const number = String(data.phone_number || "").trim();
    if (!number) return;
    try { await navigator.clipboard?.writeText(number); } catch {}
    window.open("https://www.malwarebytes.com/scam-check/phone", "_blank", "noopener,noreferrer");
  };
  const risk = RISK_META[data.risk_level] || RISK_META.medium;
  // The backend is the single source of truth for the numeric phone-risk score.
  // Never recalculate it here from community/Reddit evidence, because doing so
  // can produce a second score that disagrees with the result returned by lookup.
  const score = Math.max(0, Math.min(100, Number(data.reputation_score) || 0));
  const scoreColor = score >= 71 ? "text-destructive" : score >= 31 ? "text-warning" : "text-success";
  const barColor = score >= 71 ? "bg-destructive" : score >= 31 ? "bg-warning" : "bg-success";
  const effectiveStatus = data.caller_id_status || (data.risk_level === "high" ? "SCAM" : data.risk_level === "medium" ? "SUSPICIOUS" : "UNKNOWN");
  const status = STATUS_META[effectiveStatus] || STATUS_META.UNKNOWN;
  const totalReports = data.report_count || (data.user_reports?.length || 0);
  const hasReportCounts = (data.scam_report_count || 0) + (data.spam_report_count || 0) + (data.suspicious_report_count || 0) + (data.safe_report_count || 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-sm font-mono">{data.phone_number}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Risk score — the single numeric phone-risk metric. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Score</span>
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {score}
            <span className="text-sm text-muted-foreground">/100</span>
          </span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${score}%` }} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${risk.color}`}>
            {risk.label}
          </span>
          {data.confidence_score > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              <Activity className="w-3 h-3" />
              {data.confidence_score}% confidence
            </span>
          )}
        </div>
      </div>

      {/* Malwarebytes live verification */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/60 flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">Verify with Malwarebytes</p>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">Live check</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-5">
              Vardin cannot directly access Malwarebytes' private threat-intelligence service. Open the official Malwarebytes Scam Number Check to verify this exact number against its live database.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={checkWithMalwarebytes} className="mt-3 gap-2 rounded-lg">
              <ExternalLink className="w-3.5 h-3.5" />
              Check this number on Malwarebytes
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">The number is copied to your clipboard so you can paste it into the Malwarebytes lookup.</p>
          </div>
        </div>
      </div>

      {/* Verified business badge */}
      {data.verified_business && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30">
          <BadgeCheck className="w-4 h-4 text-success flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">
              Business Match{data.business_name ? `: ${data.business_name}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">This number matches a business record in the available data. This does not guarantee the caller is legitimate.</p>
          </div>
        </div>
      )}

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

      {/* Report counts breakdown */}
      {hasReportCounts && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" /> Community Reports ({totalReports} total)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.scam_report_count > 0 && (
              <div className="bg-destructive/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-destructive">{data.scam_report_count}</p>
                <p className="text-xs text-muted-foreground">Scam</p>
              </div>
            )}
            {data.spam_report_count > 0 && (
              <div className="bg-warning/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-warning">{data.spam_report_count}</p>
                <p className="text-xs text-muted-foreground">Spam</p>
              </div>
            )}
            {data.suspicious_report_count > 0 && (
              <div className="bg-warning/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-warning">{data.suspicious_report_count}</p>
                <p className="text-xs text-muted-foreground">Suspicious</p>
              </div>
            )}
            {data.safe_report_count > 0 && (
              <div className="bg-success/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-success">{data.safe_report_count}</p>
                <p className="text-xs text-muted-foreground">Safe</p>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Sources */}
      {data.sources?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ExternalLink className="w-3.5 h-3.5" /> Sources
          </div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((source, i) => (
              <a key={i} href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">
                {source}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Source breakdown */}
      {(data.community?.matched || data.reddit?.matched) && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" /> Evidence Sources
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-semibold">Vardin Community</p>
              <p className="text-xs text-muted-foreground mt-1">{data.community?.report_count || 0} phone report{(data.community?.report_count || 0) === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-semibold">Reddit · r/ScamNumbers</p>
              <p className="text-xs text-muted-foreground mt-1">{data.reddit?.report_count || 0} indexed report{(data.reddit?.report_count || 0) === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setReportOpen(true)} className="gap-2">
          <Flag className="w-4 h-4" /> Report this number
        </Button>
        <ReportScamDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          prefill={{
            phone_number: data.phone_number,
            scam_type: "other",
            title: `Report for ${data.phone_number}`,
            summary: `I received a suspicious or scam call/text from ${data.phone_number}.`,
            risk_level: data.risk_level || "high",
            channel: "phone_call",
          }}
          onSubmitted={() => {}}
        />
      </div>

      {/* Community Intel */}
      <div className="border-t border-border/50 pt-4">
        <CommunityIntel scamTypes={matchCategoriesToEnum(data.scam_categories)} title="Community Reports" />
      </div>
    </div>
  );
}