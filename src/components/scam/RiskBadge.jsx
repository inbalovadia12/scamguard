import React from "react";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldX as ShieldCritical } from "lucide-react";

const riskConfig = {
  low: {
    label: "Low Risk",
    color: "bg-success/10 text-success border-success/20",
    icon: ShieldCheck,
    dot: "bg-success",
    barColor: "bg-success",
  },
  medium: {
    label: "Caution",
    color: "bg-warning/10 text-warning border-warning/20",
    icon: ShieldAlert,
    dot: "bg-warning",
    barColor: "bg-warning",
  },
  high: {
    label: "High Risk",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: ShieldX,
    dot: "bg-destructive",
    barColor: "bg-destructive",
  },
  critical: {
    label: "Critical Risk",
    color: "bg-destructive/15 text-destructive border-destructive/30",
    icon: ShieldCritical,
    dot: "bg-destructive",
    barColor: "bg-destructive",
  },
};

export function getRiskLevelFromScore(score) {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function getRiskBarColor(score) {
  return riskConfig[getRiskLevelFromScore(score)]?.barColor || "bg-warning";
}

export default function RiskBadge({ level, size = "md" }) {
  const config = riskConfig[level] || riskConfig.medium;
  const Icon = config.icon;

  if (size === "lg") {
    return (
      <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2 ${config.color} text-lg font-semibold`}>
        <Icon className="w-6 h-6" />
        {config.label}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.color}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  );
}