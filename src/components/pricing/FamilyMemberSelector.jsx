import React from "react";
import { Users, Minus, Plus } from "lucide-react";
import { getPlanPricing, computeFamilyTotal } from "@/lib/planPricing";

export default function FamilyMemberSelector({ plan, members, onChange }) {
  if (plan === "starter") return null;
  const p = getPlanPricing(plan);
  const t = computeFamilyTotal(plan, members);
  const extra = t.additionalMembers;

  return (
    <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-3 animate-fade-in">
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
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {extra > 0
          ? `1 included · ${extra} extra × $${t.addonAnnual}/yr`
          : `1 included · $${t.addonAnnual}/yr per extra member`}
      </p>
      {members >= p.maxMembers && (
        <p className="mt-1 text-[10px] text-muted-foreground">Max {p.maxMembers} members on this plan.</p>
      )}
    </div>
  );
}