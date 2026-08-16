import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Users, Loader2, X, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useKidMode } from "@/lib/KidModeContext";

// Shows only when the current user is a protected member whose guardian enabled Ask Family.
// analysisType: 'scam_analysis' | 'conversation' | 'image' | 'live_guard'
export default function AskFamilyButton({ analysisId, analysisType = "scam_analysis", threatExcerpt, riskLevel = "medium", scamType = "other" }) {
  const { kidMode } = useKidMode();
  const [senior, setSenior] = useState(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const user = await base44.auth.me();
        const records = await base44.entities.ProtectedSenior.filter({});
        const mine = records.find((s) => s.senior_user_id === user.id);
        if (active) setSenior(mine || null);
      } catch {
        if (active) setSenior(null);
      } finally {
        if (active) setChecked(true);
      }
    };
    check();
  }, []);

  if (!checked || !senior) return null;
  const settings = { ask_family: true, ...(senior.protection_settings || {}) };
  if (!settings.ask_family) return null;

  const handleSubmit = async () => {
    setSending(true);
    try {
      await base44.functions.invoke("createFamilyAlert", {
        analysis_id: analysisId,
        analysis_type: analysisType,
        member_id: senior.id,
        threat_excerpt: threatExcerpt,
        risk_level: riskLevel,
        scam_type: scamType,
        member_note: note.trim() || undefined,
      });
      toast({ title: "Sent to your guardian", description: "They'll review and respond inside Vardin." });
      setNote("");
      setOpen(false);
    } catch (e) {
      toast({ title: "Couldn't send", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <MessageCircle className="w-4 h-4" />
        {kidMode ? "Ask a Grown-up" : "Ask Family"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold font-heading">Ask Family</h2>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Send this scan to your guardian for a second opinion. They'll review it and respond inside Vardin.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Add a note (optional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What's worrying you about this?"
                  rows={3}
                  maxLength={500}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={sending}>
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Send</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}