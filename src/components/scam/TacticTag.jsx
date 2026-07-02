import React from "react";
import { AlertTriangle, Clock, UserCheck, Zap, Heart, CreditCard } from "lucide-react";

const tacticIcons = {
  "Urgency": Clock,
  "Authority Impersonation": UserCheck,
  "Scarcity": Zap,
  "Love Bombing": Heart,
  "Payment Red Flags": CreditCard,
};

export default function TacticTag({ tactic }) {
  const Icon = tacticIcons[tactic] || AlertTriangle;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
      <Icon className="w-3.5 h-3.5" />
      {tactic}
    </div>
  );
}