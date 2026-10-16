import React, { useState } from "react";
import { Phone, Radio, AlertTriangle, Search } from "lucide-react";
import LiveCallAnalyzer from "@/pages/LiveCallAnalyzer";
import PhoneLookupTab from "@/components/phone/PhoneLookupTab";

export default function PhoneGuard() {
  const [activeTab, setActiveTab] = useState("call-guard");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3 animate-slide-up">
        <div className="w-10 h-10 rounded-xl luxury-gradient-btn flex items-center justify-center shadow-md shadow-primary/20">
          <Phone className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Phone Guard</h1>
          <p className="text-sm text-muted-foreground">Real-time call protection and phone number lookup.</p>
        </div>
      </div>

      {/* Shared tab bar */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-xl animate-slide-up anim-delay-1">
        <button
          onClick={() => setActiveTab("call-guard")}
          className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "call-guard" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Call Guard</span>
        </button>
        <button
          onClick={() => setActiveTab("phone-lookup")}
          className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "phone-lookup" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Phone Lookup</span>
        </button>
      </div>

      {activeTab === "call-guard" && (
        <>
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
        </>
      )}

      {activeTab === "phone-lookup" && <PhoneLookupTab />}
    </div>
  );
}