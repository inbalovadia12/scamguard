import React from "react";
import { Lock, PhoneCall, ShieldCheck, Bell, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function CallGuardLocked({ user }) {
  const isPending = user?.call_guard_enabled && user?.call_guard_status === "none";

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8 space-y-6 luxury-card-hover">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold font-heading">
            {isPending ? "Activating Call Guard" : "Call Guard is Locked"}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            {isPending
              ? "Your Call Guard subscription is being activated. This may take a few moments. Refresh this page shortly."
              : "Call Guard is a premium add-on. Enable it to screen incoming calls with an AI voice agent and get post-call scam verdicts."}
          </p>
        </div>
      </div>

      {isPending ? (
        <Button disabled className="w-full h-12">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Activation in progress...
        </Button>
      ) : (
        <>
          {/* Feature preview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
              <PhoneCall className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">AI Voice Screening</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Vardin answers and asks callers a few quick questions.</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">Post-Call Scam Analysis</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Vardin analyzes the conversation and gives a clear verdict.</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
              <Bell className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">Instant Verdicts</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Get a SAFE, SUSPICIOUS, or SCAM verdict after each call.</p>
            </div>
          </div>

          {/* Price + CTA */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-heading">$3</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <Link to="/pricing" className="w-full">
              <Button className="w-full h-12 text-base font-medium">
                <Lock className="w-4 h-4 mr-2" />
                Enable Call Guard — $3/month
              </Button>
            </Link>
            <p className="text-xs text-center text-muted-foreground">
              Billed monthly via PayPal. Cancel anytime from the Call Guard settings.
            </p>
          </div>
        </>
      )}

      {/* Note */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Call Guard is separate from Vardin's Phone Guard (number lookup) and Live Caller ID features, which remain fully available.
        </p>
      </div>
    </div>
  );
}