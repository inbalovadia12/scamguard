import React from "react";
import { Link } from "react-router-dom";
import { Clock, Eye, CheckCircle, ChevronRight } from "lucide-react";
import RiskBadge from "@/components/scam/RiskBadge";
import moment from "moment";

const statusConfig = {
  new: { label: "New", icon: Clock, color: "text-primary" },
  reviewed: { label: "Reviewed", icon: Eye, color: "text-warning" },
  handled: { label: "Handled", icon: CheckCircle, color: "text-success" },
};

export default function AlertCard({ analysis, seniorName }) {
  const status = statusConfig[analysis.guardian_status] || statusConfig.new;
  const StatusIcon = status.icon;

  return (
    <Link
      to={`/alerts/${analysis.id}`}
      className="block bg-card rounded-2xl border border-border/50 p-5 hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiskBadge level={analysis.risk_level} />
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      {seniorName && (
        <p className="text-xs text-muted-foreground mb-2">From: {seniorName}</p>
      )}

      <p className="text-sm text-foreground line-clamp-2 leading-relaxed mb-3">
        {analysis.message_text}
      </p>

      <p className="text-xs text-muted-foreground">
        {moment(analysis.created_date).fromNow()}
      </p>
    </Link>
  );
}