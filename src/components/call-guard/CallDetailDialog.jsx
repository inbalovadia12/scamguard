import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  Building2,
  MessageSquare,
  AlertTriangle,
  CreditCard,
  Clock,
  Monitor,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";

const VERDICT_CONFIG = {
  SAFE: { icon: ShieldCheck, color: "text-success", bg: "bg-success/10 border-success/20", label: "SAFE" },
  SUSPICIOUS: { icon: ShieldAlert, color: "text-warning", bg: "bg-warning/10 border-warning/20", label: "SUSPICIOUS" },
  SCAM: { icon: ShieldX, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", label: "SCAM" },
};

function formatPhone(digits) {
  if (!digits) return "Unknown";
  const d = digits.replace(/[^\d]/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function CallDetailDialog({ report, onClose }) {
  if (!report) return null;
  const verdict = VERDICT_CONFIG[report.vardin_verdict] || VERDICT_CONFIG.SAFE;
  const VerdictIcon = verdict.icon;

  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-heading">
            <Phone className="w-5 h-5 text-primary" />
            Call Guard Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Verdict banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${verdict.bg}`}>
            <VerdictIcon className={`w-8 h-8 ${verdict.color}`} />
            <div className="flex-1">
              <p className={`text-lg font-bold ${verdict.color}`}>{verdict.label}</p>
              {report.confidence_score > 0 && (
                <p className="text-xs text-muted-foreground">Confidence: {report.confidence_score}%</p>
              )}
            </div>
          </div>

          {/* Explanation */}
          {report.vardin_explanation && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">Vardin's Assessment</p>
              <p className="text-sm leading-relaxed">{report.vardin_explanation}</p>
            </div>
          )}

          {/* Scam signals */}
          {report.scam_signals && report.scam_signals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Scam Signals Detected</p>
              <div className="flex flex-wrap gap-1.5">
                {report.scam_signals.map((signal, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Call details */}
          <div className="rounded-xl border border-border/50 divide-y divide-border/30">
            <DetailRow icon={Phone} label="Caller number" value={report.caller_phone_number ? formatPhone(report.caller_phone_number) : null} />
            <DetailRow icon={Phone} label="Caller name" value={report.caller_name} />
            <DetailRow icon={Building2} label="Claimed organization" value={report.claimed_organization} />
            <DetailRow icon={MessageSquare} label="Reason for call" value={report.reason_for_call} />
            <DetailRow icon={AlertTriangle} label="Requested action" value={report.requested_action} />
            <DetailRow icon={ShieldAlert} label="Sensitive info requested" value={report.sensitive_information_requested} />
            <DetailRow icon={CreditCard} label="Payment requested" value={report.payment_requested} />
            <DetailRow icon={Clock} label="Urgency or threats" value={report.urgency_or_threats} />
            <DetailRow icon={Monitor} label="Remote access requested" value={report.remote_access_requested} />
            <DetailRow icon={Clock} label="Assessed at" value={formatDate(report.assessed_at)} />
          </div>

          {/* Summary */}
          {report.summary && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Call Summary</p>
              <p className="text-sm leading-relaxed p-3 rounded-xl bg-muted/30 border border-border/50">
                {report.summary}
              </p>
            </div>
          )}

          {/* Transcript */}
          {report.transcript && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Full Transcript</p>
              <div className="max-h-64 overflow-y-auto p-3 rounded-xl bg-muted/20 border border-border/50">
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                  {report.transcript}
                </pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}