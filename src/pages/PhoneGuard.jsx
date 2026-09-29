import React from "react";
import { Phone, Radio, AlertTriangle } from "lucide-react";
import LiveCallAnalyzer from "@/pages/LiveCallAnalyzer";

export default function PhoneGuard() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3 animate-slide-up">
        <div className="w-10 h-10 rounded-xl luxury-gradient-btn flex items-center justify-center shadow-md shadow-primary/20">
          <Phone className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Phone Guard</h1>
          <p className="text-sm text-muted-foreground">Real-time AI protection while you're on a call.</p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Call Guard privacy warning</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Call Guard is a cloud-based analysis feature. If you use live capture or upload a recording, audio is sent to Vardin's backend and to AssemblyAI for speech-to-text. Only record or upload calls when you have the rights and consent required by applicable law.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Radio className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Call Guard</span>
      </div>

      <LiveCallAnalyzer />
    </div>
  );
}
