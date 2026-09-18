import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShieldCheck, ShieldAlert, MessageCircle, Clock, Loader2, MessageSquare,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import RiskBadge from "@/components/scam/RiskBadge";
import ChatThread from "@/components/family/ChatThread";

const RESOLVED_CONFIG = {
  mark_safe: {
    label: "Marked Safe",
    icon: ShieldCheck,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    memberMsg: "Your guardian reviewed this and said it's safe.",
  },
  confirm_scam: {
    label: "Warned: Scam",
    icon: ShieldAlert,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    memberMsg: "Your guardian warned this is a scam — do not engage.",
  },
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

// canRespond = true for guardian viewing a pending alert; false for member (read-only)
export default function FamilyAlertCard({ alert, memberName, canRespond, onResponded }) {
  const [saving, setSaving] = useState(null); // 'warning' | 'assurance' | null
  const [chatOpen, setChatOpen] = useState(false);

  const cfg = alert.guardian_action ? RESOLVED_CONFIG[alert.guardian_action] : null;
  const initials = (memberName || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const quickRespond = async (kind) => {
    setSaving(kind);
    try {
      await base44.functions.invoke("sendFamilyChatMessage", {
        member_id: alert.member_id,
        kind,
        alert_id: alert.id,
        text: "",
      });
      toast({
        title: kind === "warning" ? "Warning sent" : "Assurance sent",
        description: "Your family member will see it in their Chats tab.",
      });
      onResponded?.();
    } catch (e) {
      toast({ title: "Couldn't respond", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setSaving(null);
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
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => quickRespond("warning")}
              disabled={!!saving}
              className="flex flex-col items-center gap-1 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-medium hover:bg-destructive/10 transition-all disabled:opacity-50"
            >
              {saving === "warning" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              Warn
            </button>
            <button
              onClick={() => quickRespond("assurance")}
              disabled={!!saving}
              className="flex flex-col items-center gap-1 p-3 rounded-xl border border-success/30 bg-success/5 text-success text-xs font-medium hover:bg-success/10 transition-all disabled:opacity-50"
            >
              {saving === "assurance" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Assure
            </button>
            <button
              onClick={() => setChatOpen(true)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
          </div>
        </div>
      )}

      {alert.status === "resolved" && cfg && (
        <div className={`rounded-xl border p-3.5 ${cfg.border} ${cfg.bg}`}>
          <div className="flex items-center gap-2">
            <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
            <p className={`text-sm font-semibold ${cfg.color}`}>
              {canRespond ? `You chose: ${cfg.label}` : cfg.memberMsg}
            </p>
          </div>
          {alert.guardian_note && <p className="text-sm mt-1.5 text-foreground/80">{alert.guardian_note}</p>}
        </div>
      )}

      {alert.status === "resolved" && (
        <Button variant="outline" size="sm" onClick={() => setChatOpen(true)} className="w-full gap-2">
          <MessageSquare className="w-4 h-4" /> Continue chat
        </Button>
      )}

      {alert.status === "pending_guardian" && !canRespond && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
          <Clock className="w-3.5 h-3.5" /> Waiting for your guardian's response...
        </div>
      )}

      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              Chat with {memberName || "family member"}
            </DialogTitle>
          </DialogHeader>
          <ChatThread memberId={alert.member_id} onSent={onResponded} />
        </DialogContent>
      </Dialog>
    </div>
  );
}