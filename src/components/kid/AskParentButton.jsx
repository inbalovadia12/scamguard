import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, Loader2, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const QUICK_MESSAGES = [
  "I'm not sure about something I saw online",
  "Something feels weird about this message",
  "Someone asked for my password or code",
  "I think I might have made a mistake",
];

export default function AskParentButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [guardianEmail, setGuardianEmail] = useState(null);

  useEffect(() => {
    if (!open) return;
    const loadGuardian = async () => {
      try {
        const user = await base44.auth.me();
        const seniors = await base44.entities.ProtectedSenior.filter({ senior_user_id: user.id });
        if (seniors.length > 0) setGuardianEmail(seniors[0].guardian_email || null);
      } catch {}
    };
    loadGuardian();
  }, [open]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      if (!guardianEmail) {
        setError("No guardian email found. Ask your parent to set up family protection.");
        setSending(false);
        return;
      }
      await base44.integrations.Core.SendEmail({
        to: guardianEmail,
        subject: "🚨 Your child needs help — Vardin Ask a Parent",
        body: `${user.full_name || user.email} sent you a message from Vardin's "Ask a Parent" button:\n\n"${message}"\n\nPlease check in with them soon.`,
      });
      setSent(true);
    } catch (e) {
      setError(e.message || "Could not send message. Please try again.");
    }
    setSending(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => { setSent(false); setMessage(""); setError(null); }, 300);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 sm:right-6 md:bottom-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Ask a Parent"
      >
        <Heart className="w-6 h-6" fill="white" />
      </button>
      <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
        <DialogContent className="max-w-md">
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-bold">Message sent! 💌</h3>
              <p className="text-sm text-muted-foreground">Your parent or guardian has been notified. They'll check in with you soon.</p>
              <Button onClick={handleClose} className="w-full">Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500" /> Ask a Parent
                </DialogTitle>
                <DialogDescription>
                  Not sure about something? Send a quick message to your parent or guardian.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {QUICK_MESSAGES.map((msg, i) => (
                    <button
                      key={i}
                      onClick={() => setMessage(msg)}
                      className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="min-h-[100px] resize-none"
                  disabled={sending}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="w-full gap-2 bg-gradient-to-r from-pink-500 to-rose-500"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending..." : "Send to Parent"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}