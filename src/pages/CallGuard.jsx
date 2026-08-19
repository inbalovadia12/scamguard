import React from "react";
import { PhoneCall, ShieldCheck, Lock, Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CallGuard() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <PhoneCall className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Call Guard</h1>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/20 tracking-wider uppercase">
            Under Construction
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          AI-powered call screening is coming soon.
        </p>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8 space-y-6 luxury-card-hover">
        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold font-heading">Screen Calls Before You Answer</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Vardin will eventually be able to screen incoming calls with an AI voice agent before you pick up — asking callers a few quick questions, cross-referencing them with scam databases, and alerting you if the caller seems suspicious so you can decide whether to answer.
            </p>
          </div>
        </div>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2 opacity-60">
            <PhoneCall className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium">AI Voice Screening</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Vardin answers and asks callers a few quick questions.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2 opacity-60">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium">Real-Time Risk Check</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Cross-references the caller against known scam numbers.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2 opacity-60">
            <Bell className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium">Instant Alerts</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Get a risk verdict before the call reaches you.</p>
          </div>
        </div>

        {/* Disabled button */}
        <Button disabled className="w-full h-12 text-base font-medium">
          <Lock className="w-4 h-4 mr-2" />
          Coming Soon
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          This feature is under active development and is not yet available. No charges apply.
        </p>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Call Guard is separate from Vardin's existing Phone Guard (number lookup) and Live Caller ID features, which remain fully available.
        </p>
      </div>
    </div>
  );
}