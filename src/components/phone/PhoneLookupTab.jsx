import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Phone, Search, Loader2, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneResultView from "@/components/scam/PhoneResultView";
import AIDisclaimer from "@/components/AIDisclaimer";

const LOADING_STEPS = [
  "Looking up carrier and identity data...",
  "Searching the web for scam reports...",
  "Verifying phone numbers on official pages...",
  "Analyzing evidence and scoring risk...",
];

export default function PhoneLookupTab() {
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runPipeline = async (phone) => {
    const sourceResponse = await base44.functions.invoke("lookupPhoneSources", { phone_number: phone });
    const phoneSources = sourceResponse?.data || sourceResponse;
    if (!phoneSources || phoneSources.error) {
      throw new Error(phoneSources?.error || "Source lookup failed");
    }

    setLoadingStep(1);
    const webResponse = await base44.functions.invoke("searchPhoneWebEvidence", { phone });
    const webEvidence = webResponse?.data || webResponse;
    if (!webEvidence || webEvidence.error) {
      throw new Error(webEvidence?.error || "Web evidence search failed");
    }

    setLoadingStep(2);
    const evidenceResponse = await base44.functions.invoke("normalizePhoneEvidence", {
      phone_sources: phoneSources,
      web_evidence: webEvidence,
      phone,
    });
    const evidence = evidenceResponse?.data || evidenceResponse;
    if (!evidence || evidence.error) {
      throw new Error(evidence?.error || "Evidence normalization failed");
    }

    setLoadingStep(3);
    const riskResponse = await base44.functions.invoke("scorePhoneRisk", {
      phone,
      phone_evidence: evidence,
    });
    const risk = riskResponse?.data?.result || riskResponse?.result;
    if (!risk) {
      throw new Error(riskResponse?.data?.error || riskResponse?.error || "Risk scoring failed");
    }

    return { risk, evidence };
  };

  const handleLookup = async () => {
    const phone = phoneInput.trim();
    if (!phone) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(0);

    try {
      const { risk, evidence } = await runPipeline(phone);

      const evidenceReasons = Array.isArray(risk.evidence_reasons) ? risk.evidence_reasons : [];
      const legitimacyReasons = Array.isArray(risk.legitimacy_reasons) ? risk.legitimacy_reasons : [];
      const summaryParts = [...evidenceReasons, ...legitimacyReasons];
      const summary = summaryParts.length > 0
        ? summaryParts.join(" ")
        : risk.evidence_state === "insufficient_evidence"
          ? "No verified evidence was found for this number. This does not mean the number is safe — it means there is not enough public information to classify it."
          : null;

      setResult({
        ...risk,
        phone_number: phone,
        sources: Array.isArray(evidence.sources) ? evidence.sources : [],
        user_reports: evidenceReasons,
        summary,
      });
    } catch (err) {
      console.error("Phone lookup failed:", err);
      setError(err?.message || "Phone lookup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhoneInput("");
    setResult(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-2xl border border-border/50 p-8 sm:p-12 text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
            <Loader2 className="w-7 h-7 text-primary-foreground animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold font-heading">Looking up {phoneInput}</h3>
            <p className="text-sm text-muted-foreground">{LOADING_STEPS[loadingStep]}</p>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i <= loadingStep ? "bg-primary w-8" : "bg-muted w-4"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            This searches multiple sources and verifies phone numbers on official pages. It can take 10-20 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-5 animate-scale-in">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold font-heading">Lookup Result</h3>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <Search className="w-4 h-4" /> Look up another
          </Button>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 sm:p-6">
          <PhoneResultView data={result} />
        </div>
        <AIDisclaimer />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-7 space-y-5 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
            <Search className="w-6 h-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">Phone Number Lookup</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Enter any phone number to get a fresh risk assessment — caller identity, country, carrier, scam reports, and verified web evidence.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Phone number
          </label>
          <Input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && phoneInput.trim() && handleLookup()}
            placeholder="Enter phone number here"
            className="h-11 sm:h-12 text-base rounded-xl"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Include the country code for international numbers. The lookup verifies the exact number on official business pages and scam-report sites.
          </p>
        </div>

        <Button
          onClick={handleLookup}
          disabled={!phoneInput.trim() || loading}
          className="w-full h-11 sm:h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 gap-2"
          size="lg"
        >
          <ShieldCheck className="w-5 h-5" />
          Look Up Number
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Lookup failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      <AIDisclaimer />
    </div>
  );
}