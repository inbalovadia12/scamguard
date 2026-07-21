import React, { useState, useEffect } from "react";
import { Phone, Search, Loader2, History, Clock, ChevronRight, Crown, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneResultView from "@/components/scam/PhoneResultView";
import { getCreditStatus } from "@/lib/credits";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import AIDisclaimer from "@/components/AIDisclaimer";

export default function PhoneLookup() {
  const [phoneInput, setPhoneInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    const init = async () => {
      const status = await getCreditStatus();
      setIsPremium(status.isPremiumPlan);
      setCheckingPlan(false);
      if (status.isPremiumPlan) loadHistory();
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

  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center space-y-4 animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-heading">Phone Number Lookup</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Check any phone number's reputation score, carrier, country, and scam reports from real users.
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Phone className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Phone Number Lookup</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Check any phone number's reputation, carrier, and scam reports. Powered by AI with live web data.
        </p>
      </div>

      {/* Input */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="555 123 4567"
              className="pl-9"
            />
          </div>
          <Button onClick={handleLookup} disabled={looking || !phoneInput.trim()} className="gap-2">
            {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Lookup
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

      {/* Result */}
      {!looking && currentResult && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 animate-slide-up">
          <PhoneResultView data={currentResult} />
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
                score >= 71
                  ? "text-destructive bg-destructive/10"
                  : score >= 31
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