import React, { useState, useEffect } from "react";
import { PhoneIncoming, Search, Loader2, Crown, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCreditStatus } from "@/lib/credits";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import AIDisclaimer from "@/components/AIDisclaimer";

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "Likely Safe" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Be Cautious" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "Likely Scam" },
};

export default function CallerCheck() {
  const [phoneInput, setPhoneInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    const init = async () => {
      const status = await getCreditStatus();
      setCreditStatus(status);
      setCheckingPlan(false);
    };
    init();
  }, []);

  const handleLookup = async () => {
    if (!phoneInput.trim()) return;
    setLooking(true);
    setError(null);
    setResult(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("lookupPhoneNumber", {
        phone_number: phoneInput.trim(),
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      setResult(response.data?.result);
    } catch (e) {
      setError(e.message || "Lookup failed. Please try again.");
    } finally {
      setLooking(false);
    }
  };

  if (checkingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!creditStatus?.isPremium) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center space-y-4 animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <PhoneIncoming className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-heading">Caller Check</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Got a call from an unknown number? Check it instantly before you engage.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Crown className="w-4 h-4" /> Premium Feature
          </div>
          <Button asChild>
            <Link to="/pricing">Upgrade to Premium</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cfg = result ? (RISK_CONFIG[result.risk_level] || RISK_CONFIG.low) : null;
  const RiskIcon = cfg?.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <PhoneIncoming className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Caller Check</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Unknown number calling? Check it instantly before you engage.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <PhoneIncoming className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="Enter unknown caller number..."
              className="pl-9 h-12 text-base"
              autoFocus
            />
          </div>
          <Button onClick={handleLookup} disabled={looking || !phoneInput.trim()} className="gap-2 h-12 px-6">
            {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Check
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <AIDisclaimer />

      {looking && <LongLoadingScreen type="phone" />}

      {!looking && result && cfg && RiskIcon && (
        <div className="animate-slide-up space-y-4">
          <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6 text-center`}>
            <div className={`w-16 h-16 rounded-full ${cfg.bg} flex items-center justify-center mx-auto mb-3`}>
              <RiskIcon className={`w-8 h-8 ${cfg.color}`} />
            </div>
            <h2 className={`text-2xl font-bold font-heading ${cfg.color}`}>{cfg.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">Risk Score: {result.reputation_score}/100</p>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
            {result.country && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{result.country}</span>
              </div>
            )}
            {result.carrier && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Carrier</span>
                <span className="font-medium">{result.carrier}</span>
              </div>
            )}
            {result.scam_categories?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {result.scam_categories.map((cat, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                    {cat}
                  </span>
                ))}
              </div>
            )}
            {result.summary && (
              <p className="text-sm text-muted-foreground pt-2 border-t border-border/50">{result.summary}</p>
            )}
            {result.sources?.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Sources:</p>
                <div className="space-y-1">
                  {result.sources.slice(0, 5).map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block truncate">
                      {src}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}