import React from "react";
import { Users, Minus, Plus } from "lucide-react";
import { getPlanPricing, computeFamilyTotal } from "@/lib/planPricing";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] text-muted-foreground leading-5 min-w-0">{label}</span>
      <span className="text-[11px] font-medium text-foreground leading-5 text-right whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

export default function FamilyMemberSelector({ plan, members, onChange }) {
  if (plan === "starter") return null;
  const p = getPlanPricing(plan);
  const t = computeFamilyTotal(plan, members);
  const extra = t.additionalMembers;

  return (
    <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2.5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium flex items-center gap-1.5 min-w-0">
          <Users className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Protected members</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onChange(Math.max(p.includedMembers, members - 1))}
            disabled={members <= p.includedMembers}
            className="w-7 h-7 rounded-lg border border-border/50 bg-card flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors"
            aria-label="Remove member"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-semibold w-7 text-center tabular-nums">{t.members}</span>
          <button
            type="button"
            onClick={() => onChange(Math.min(p.maxMembers, members + 1))}
            disabled={members >= p.maxMembers}
            className="w-7 h-7 rounded-lg border border-border/50 bg-card flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors"
            aria-label="Add member"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Row label={`Base plan (1 member)`} value={`$${t.baseAnnual}/yr`} />
        <Row
          label={extra > 0 ? `Extra members (${extra} × $${t.addonAnnual}/yr)` : `Extra members ($${t.addonAnnual}/yr each)`}
          value={extra > 0 ? `$${t.additionalCostAnnual}/yr` : "—"}
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <span className="text-xs font-semibold">Total</span>
        <div className="text-right leading-tight">
          <span className="block text-sm font-bold text-primary tabular-nums">${t.totalAnnual}/yr</span>
          <span className="block text-[10px] text-muted-foreground tabular-nums">${t.totalMonthly.toFixed(2)}/mo · billed annually</span>
        </div>
      </div>

      {members >= p.maxMembers && (
        <p className="text-[10px] text-muted-foreground">Max {p.maxMembers} members on this plan.</p>
      )}
    </div>
  );
}