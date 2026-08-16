import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ShieldAlert, ShieldX, MessageSquare, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import RiskBadge from "@/components/scam/RiskBadge";

const ACTION_CONFIG = {
  mark_safe: { label: "Mark Safe", icon: ShieldCheck, color: "text-success", bg: "bg-success/10", border: "border-success/30", emoji: "✅", memberMsg: "Your guardian reviewed this and said it's safe." },
  confirm_scam: { label: "Confirm Scam", icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", emoji: "🚨", memberMsg: "Your guardian confirmed this is a scam — do not engage." },
  ignore: { label: "Tell Them to Ignore", icon: ShieldX, color: "text-muted-foreground", bg: "bg-muted", border: "border-border", emoji: "⛔", memberMsg: "Your guardian said to ignore this." },
  guidance: { label: "Give Guidance", icon: MessageSquare, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", emoji: "💬", memberMsg: "Your guardian sent guidance:" },
};

function timeAgo(date) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// canRespond = true for guardian viewing a pending alert; false for member (read-only response)
export default function FamilyAlertCard({ alert, memberName, canRespond }) {
  const [action, setAction] = useState(null);
  const [guidance, setGuidance] = useState("");
  const [saving, setSaving] = useState(false);

  const cfg = alert.guardian_action ? ACTION_CONFIG[alert.guardian_action] : null;
  const initials = (memberName || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const respond = async (chosen, note) => {
    setSaving(true);
    try {
      await base44.entities.FamilyAlert.update(alert.id, {
        guardian_action: chosen,
        guardian_note: chosen === "guidance" ? (note || "").trim() : undefined,
        status: "resolved",
      });
      toast({ title: "Response sent", description: "Your family member will see it in Vardin." });
      setAction(null);
      setGuidance("");
    } catch (e) {
      toast({ title: "Couldn't respond", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-card rounded-2xl border p-5 space-y-4 ${alert.status === "pending_guardian" ? "border-warning/40" : "border-border/50"}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary/60 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{memberName || "Family member"}</h3>
            {alert.risk_level && <RiskBadge level={alert.risk_level} size="sm" />}
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="w-3 h-3" />{timeAgo(alert.created_date)}
            </span>
          </div>
          <p className="text-sm text-foreground/80 mt-1.5 line-clamp-3">{alert.threat_excerpt || "Scam alert"}</p>
          {alert.scam_type && (
            <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
              {alert.scam_type.replace(/_/g, " ")}
            </span>
          )}
          {alert.member_note && (
            <div className="mt-2 text-xs bg-muted/50 rounded-lg px-3 py-2 border border-border/40">
              <span className="font-medium">Note: </span>{alert.member_note}
            </div>
          )}
        </div>
      </div>

      {alert.status === "pending_guardian" && canRespond && (
        <div className="space-y-2.5 pt-2 border-t border-border/40">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Respond</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ACTION_CONFIG).map(([key, c]) => {
              const Icon = c.icon;
              const active = action === key;
              return (
                <button
                  key={key}
                  onClick={() => setAction(key)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${active ? `${c.border} ${c.bg} ${c.color}` : "border-border/50 hover:border-primary/30"}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {c.label}
                </button>
              );
            })}
          </div>
          {action === "guidance" && (
            <Textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} placeholder="Type your guidance..." rows={2} maxLength={500} />
          )}
          {action && (
            <Button onClick={() => respond(action, guidance)} disabled={saving || (action === "guidance" && !guidance.trim())} className="w-full gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><CheckCircle2 className="w-4 h-4" /> Send Response</>}
            </Button>
          )}
        </div>
      )}

      {alert.status === "resolved" && cfg && (
        <div className={`rounded-xl border p-3.5 ${cfg.border} ${cfg.bg}`}>
          <div className="flex items-center gap-2">
            <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
            <p className={`text-sm font-semibold ${cfg.color}`}>
              {cfg.emoji} {canRespond ? `You chose: ${cfg.label}` : cfg.memberMsg}
            </p>
          </div>
          {alert.guardian_note && <p className="text-sm mt-1.5 text-foreground/80">{alert.guardian_note}</p>}
        </div>
      )}

      {alert.status === "pending_guardian" && !canRespond && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
          <Clock className="w-3.5 h-3.5" /> Waiting for your guardian's response...
        </div>
      )}
    </div>
  );
}