import React, { useState } from "react";
import {
  ShieldCheck, ShieldAlert, Mail, Crown, Users, LogOut, Check, Loader2,
  Clock, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function SiblingRow({ sib }) {
  const initials = (sib.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {sib.name}
          {sib.is_you ? <span className="text-primary"> (you)</span> : null}
        </p>
        {sib.email && <p className="text-xs text-muted-foreground truncate">{sib.email}</p>}
      </div>
      {sib.consent_given ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full whitespace-nowrap">
          <BadgeCheck className="w-3 h-3" /> Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full whitespace-nowrap">
          <Clock className="w-3 h-3" /> Pending
        </span>
      )}
    </div>
  );
}

export default function ProtectedMemberView({ memberships, onAccept, onLeave }) {
  const [busy, setBusy] = useState(null);

  const handle = async (fn, id) => {
    setBusy(id);
    try { await fn(id); } finally { setBusy(null); }
  };

  if (!memberships || memberships.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Protection</h2>
        <span className="text-xs text-muted-foreground/60">({memberships.length})</span>
      </div>

      {memberships.map((m) => {
        const isProtected = m.consent_given;
        const siblings = (m.siblings || []).filter((s) => !s.is_you);
        return (
          <div
            key={m.senior_record_id}
            className="bg-card rounded-2xl border border-border/50 p-5 sm:p-6 animate-slide-up hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 text-white shadow-sm">
                <Crown className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">{m.guardian_name}</h3>
                      {isProtected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <BadgeCheck className="w-3 h-3" /> Protected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <Clock className="w-3 h-3" /> Pending invite
                        </span>
                      )}
                    </div>
                    {m.guardian_email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{m.guardian_email}</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Guardian · {m.guardian_plan} plan
                    </p>
                  </div>
                  {isProtected ? (
                    <ShieldCheck className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-warning flex-shrink-0" />
                  )}
                </div>

                {isProtected && siblings.length > 0 && (
                  <div className="pt-3 border-t border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Others in this family ({siblings.length})
                      </p>
                    </div>
                    <div className="divide-y divide-border/30">
                      {siblings.map((sib, i) => (
                        <SiblingRow key={i} sib={sib} />
                      ))}
                    </div>
                  </div>
                )}

                {!isProtected && (
                  <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-xs text-muted-foreground leading-relaxed">
                    {m.guardian_name} added you to their Vardin family. Accept to activate scam protection and share the {m.guardian_plan} plan benefits.
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                  {!isProtected && (
                    <Button
                      size="sm"
                      onClick={() => handle(onAccept, m.senior_record_id)}
                      disabled={busy === m.senior_record_id}
                      className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                    >
                      {busy === m.senior_record_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Accept invitation
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handle(onLeave, m.senior_record_id)}
                    disabled={busy === m.senior_record_id}
                    className="gap-2 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    {isProtected ? "Leave Family" : "Decline"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}