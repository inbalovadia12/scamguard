import React from "react";
import { Users, Minus, Plus } from "lucide-react";
import { getPlanPricing, computeFamilyTotal } from "@/lib/planPricing";

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function FamilyMemberSelector({ plan, members, onChange }) {
  if (plan === "starter") return null;
  const p = getPlanPricing(plan);
  const t = computeFamilyTotal(plan, members);

  return (
    <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2.5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium flex items-center gap-1.5 min-w-0">
          <Users className="w-3.5 h-3.5 text-primary shrink-0" />
          Protected members
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChange(Math.max(p.includedMembers, members - 1))}
            disabled={members <= p.includedMembers}
            className="w-7 h-7 rounded-lg border border-border/50 bg-card flex items-center justify-center disabled:opacity-40 hover:bg-muted"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-semibold w-6 text-center">{t.members}</span>
          <button
            type="button"
            onClick={() => onChange(Math.min(p.maxMembers, members + 1))}
            disabled={members >= p.maxMembers}
            className="w-7 h-7 rounded-lg border border-border/50 bg-card flex items-center justify-center disabled:opacity-40 hover:bg-muted"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <Row label="Base plan" value={`$${t.baseAnnual}/yr`} />
        <Row
          label={`Add-on (${t.additionalMembers} × $${t.addonAnnual}/yr)`}
          value={t.additionalMembers > 0 ? `$${t.additionalCostAnnual}/yr` : "Included"}
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <span className="text-xs font-medium text-muted-foreground">Total</span>
        <div className="text-right leading-tight">
          <span className="block text-sm font-bold text-primary">${t.totalAnnual}/yr</span>
          <span className="block text-[10px] text-muted-foreground">${t.totalMonthly.toFixed(2)}/mo · billed annually</span>
        </div>
      </div>

      {members >= p.maxMembers && (
        <p className="text-[10px] text-muted-foreground">Maximum {p.maxMembers} members on this plan.</p>
      )}
    </div>
  );
}