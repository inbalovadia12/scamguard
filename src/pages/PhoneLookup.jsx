import React, { useState, useEffect } from "react";
import { Phone, Search, Loader2, History, Clock, ChevronRight, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneResultView from "@/components/scam/PhoneResultView";
import PlanGate from "@/components/PlanGate";
import { getCreditStatus } from "@/lib/credits";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import AIDisclaimer from "@/components/AIDisclaimer";

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "Likely Safe" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Be Cautious" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "Likely Scam" },
};

export default function PhoneLookup() {
  const [phoneInput, setPhoneInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    const init = async () => {
      const status = await getCreditStatus();
      setCreditStatus(status);
      setCheckingPlan(false);
      if (status.isPaid) loadHistory();
      else setLoadingHistory(false);
    };
    init();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await base44.entities.PhoneLookup.list("-created_date", 20);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLookup = async () => {
    if (!phoneInput.trim()) return;
    setLooking(true);
    setError(null);
    setCurrentResult(null);
    setSelectedId(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("lookupPhoneNumber", {
        phone_number: phoneInput.trim(),
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      const result = response.data?.result;
      const saved = response.data?.lookup;
      setCurrentResult({
        phone_number: phoneInput.trim(),
        country: result.country,
        carrier: result.carrier,
        reputation_score: result.reputation_score,
        risk_level: result.risk_level,
        user_reports: result.user_reports || [],
        scam_categories: result.scam_categories || [],
        summary: result.summary || "",
        sources: result.sources || [],
        report_count: result.report_count || 0,
        scam_report_count: result.scam_report_count || 0,
        spam_report_count: result.spam_report_count || 0,
        suspicious_report_count: result.suspicious_report_count || 0,
        safe_report_count: result.safe_report_count || 0,
        caller_id_status: result.caller_id_status || "UNKNOWN",
        confidence_score: result.confidence_score || 0,
        verified_business: result.verified_business || false,
        business_name: result.business_name || "",
        caller_id_label: result.caller_id_label || "",
        created_date: saved?.created_date || new Date().toISOString(),
      });
      loadHistory();
    } catch (e) {
      setError(e.message || "Lookup failed. Please try again.");
    } finally {
      setLooking(false);
    }
  };

  const handleSelectHistory = (lookup) => {
    setSelectedId(lookup.id);
    setCurrentResult({
      phone_number: lookup.phone_number,
      country: lookup.country,
      carrier: lookup.carrier,
      reputation_score: lookup.reputation_score,
      risk_level: lookup.risk_level,
      user_reports: lookup.user_reports || [],
      scam_categories: lookup.scam_categories || [],
      summary: lookup.summary || "",
      sources: lookup.sources || [],
      report_count: lookup.report_count || 0,
      scam_report_count: lookup.scam_report_count || 0,
      spam_report_count: lookup.spam_report_count || 0,
      suspicious_report_count: lookup.suspicious_report_count || 0,
      safe_report_count: lookup.safe_report_count || 0,
      caller_id_status: lookup.caller_id_status || "UNKNOWN",
      confidence_score: lookup.confidence_score || 0,
      verified_business: lookup.verified_business || false,
      business_name: lookup.business_name || "",
      caller_id_label: lookup.caller_id_label || "",
      created_date: lookup.created_date,
    });
  };

  if (checkingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!creditStatus?.isPaid) {
    return (
      <PlanGate
        icon={Phone}
        title="Phone Number Lookup"
        description="Check any phone number's reputation score, carrier, country, and scam reports from real users."
        plan="Plus"
      />
    );
  }

  const cfg = currentResult ? (RISK_CONFIG[currentResult.risk_level] || RISK_CONFIG.low) : null;
  const RiskIcon = cfg?.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      {/* Input */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="Enter phone number..."
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

      {/* Loading state */}
      {looking && <LongLoadingScreen type="phone" />}

      {/* Result — quick risk badge + full details */}
      {!looking && currentResult && cfg && RiskIcon && (
        <div className="space-y-4 animate-slide-up">
          <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6 text-center`}>
            <div className={`w-16 h-16 rounded-full ${cfg.bg} flex items-center justify-center mx-auto mb-3`}>
              <RiskIcon className={`w-8 h-8 ${cfg.color}`} />
            </div>
            <h2 className={`text-2xl font-bold font-heading ${cfg.color}`}>{cfg.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">Reputation Score: {currentResult.reputation_score}/100 · Higher is generally better</p>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <PhoneResultView data={currentResult} />
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Past Lookups</h2>
        </div>
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No past lookups yet. Search a phone number above.</p>
        ) : (
          <div className="space-y-2">
            {history.map((lookup) => {
              const isSelected = lookup.id === selectedId;
              const score = lookup.reputation_score || 0;
              const scoreColor =
                score <= 35
                  ? "text-destructive bg-destructive/10"
                  : score <= 70
                  ? "text-warning bg-warning/10"
                  : "text-success bg-success/10";
              return (
                <button
                  key={lookup.id}
                  onClick={() => handleSelectHistory(lookup)}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all text-left ${
                    isSelected ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate font-mono">{lookup.phone_number}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(lookup.created_date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lookup.country && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">{lookup.country}</span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreColor}`}>
                      {score}/100
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}