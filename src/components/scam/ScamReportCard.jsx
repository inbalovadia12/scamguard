import React from "react";
import { ThumbsUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const SCAM_TYPE_META = {
  phishing_email: { label: "Phishing Email", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  smishing: { label: "Scam Text", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  romance: { label: "Romance Scam", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  crypto_investment: { label: "Crypto / Investment", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  marketplace: { label: "Marketplace Scam", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  tech_support: { label: "Tech Support", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  fake_job: { label: "Fake Job Offer", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  delivery: { label: "Delivery Scam", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  lottery_prize: { label: "Lottery / Prize", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  government_impersonation: { label: "Gov Impersonation", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  bank_impersonation: { label: "Bank Impersonation", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  other: { label: "Other", color: "bg-muted text-muted-foreground" },
};

export const RISK_META = {
  high: { label: "High Risk", color: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium Risk", color: "bg-warning/10 text-warning" },
  low: { label: "Low Risk", color: "bg-success/10 text-success" },
};

export const CHANNEL_LABELS = {
  email: "Email", sms: "Text Message", phone_call: "Phone Call", social_media: "Social Media",
  marketplace: "Marketplace", website: "Website", in_person: "In Person", other: "Other",
};

export const SCAM_TYPE_OPTIONS = Object.entries(SCAM_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }));
export const CHANNEL_OPTIONS = Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }));
export const RISK_OPTIONS = [
  { value: "low", label: "Low Risk" },
  { value: "medium", label: "Medium Risk" },
  { value: "high", label: "High Risk" },
];

export default function ScamReportCard({ report, onVerify, verifying }) {
  const typeMeta = SCAM_TYPE_META[report.scam_type] || SCAM_TYPE_META.other;
  const riskMeta = RISK_META[report.risk_level] || RISK_META.medium;

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3 animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeMeta.color}`}>{typeMeta.label}</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${riskMeta.color}`}>{riskMeta.label}</span>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
          {formatDistanceToNow(new Date(report.created_date), { addSuffix: true })}
        </span>
      </div>
      <h3 className="font-semibold text-sm">{report.title}</h3>
      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{report.summary}</p>
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {report.channel && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {CHANNEL_LABELS[report.channel] || report.channel}
            </span>
          )}
          {report.country && <span>· {report.country}</span>}
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            {report.verified_count || 0} verified
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onVerify}
          disabled={verifying}
          className="gap-1.5 h-7 text-xs"
        >
          <ThumbsUp className="w-3 h-3" />
          I've seen this
        </Button>
      </div>
    </div>
  );
}