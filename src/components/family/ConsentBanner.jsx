import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function ConsentBanner() {
  const [invites, setInvites] = useState([]);
  const [userId, setUserId] = useState(null);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      if (!user?.email) return;
      const pending = await base44.entities.ProtectedSenior.filter({ email: user.email, consent_given: false });
      setUserId(user.id);
      setInvites(pending.filter((p) => p.guardian_id !== user.id));
    };
    load();
  }, []);

  const handleAccept = async (invite) => {
    setAccepting(invite.id);
    try {
      await base44.entities.ProtectedSenior.update(invite.id, {
        senior_user_id: userId,
        consent_given: true,
      });
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast({ title: "You're protected!", description: `${invite.guardian_name || "Your family member"} will now be alerted when you check suspicious messages.` });
    } catch (err) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setAccepting(null);
    }
  };

  const handleDismiss = (id) => {
    setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  if (invites.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-slide-up">
      {invites.map((invite) => (
        <div key={invite.id} className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {invite.guardian_name || "A family member"} wants to help protect you
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              They'll be alerted when you check suspicious messages, so they can help you stay safe. You can revoke this anytime.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => handleDismiss(invite.id)} className="text-muted-foreground">
              Not now
            </Button>
            <Button size="sm" onClick={() => handleAccept(invite)} disabled={accepting === invite.id} className="gap-1.5 bg-gradient-to-r from-primary to-primary/80">
              {accepting === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}