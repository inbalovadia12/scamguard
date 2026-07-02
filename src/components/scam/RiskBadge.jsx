import React from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

const riskConfig = {
  low: {
    label: "Low Risk",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: ShieldCheck,
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Caution",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: ShieldAlert,
    dot: "bg-amber-500",
  },
  high: {
    label: "High Risk",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: ShieldX,
    dot: "bg-red-500",
  },
};

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