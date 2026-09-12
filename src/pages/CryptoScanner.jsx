import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import {
  Bitcoin, TrendingUp, Link2, Crown, AlertTriangle, ShieldCheck,
} from "lucide-react";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import AIDisclaimer from "@/components/AIDisclaimer";
import CryptoScanResult from "@/components/scam/CryptoScanResult";
import { getCreditStatus, CREDIT_COSTS } from "@/lib/credits";
import { getSeniorLink } from "@/lib/guardianAlerts";
import { redactMessage } from "@/lib/redact";
import { useToast } from "@/components/ui/use-toast";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number", description: "0-100 risk score. Low risk = 0-35, Medium risk = 36-70, High risk = 71-100. Must match the risk_level." },
    explanation: { type: "string" },
    is_likely_scam: { type: "boolean" },
    red_flags: { type: "array", items: { type: "string" } },
    tactics_detected: { type: "array", items: { type: "string" } },
    what_they_want: { type: "string" },
    why_scammers_do_this: { type: "string" },
    what_to_say: { type: "string" },
    next_steps: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
  },
};

export default function CryptoScanner() {
  const { toast } = useToast();
  const [mode, setMode] = useState("link");
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [credits, setCredits] = useState(null);
  const [seniorLink, setSeniorLink] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setCredits(await getCreditStatus());
        const user = await base44.auth.me();
        setSeniorLink(await getSeniorLink(user.id));
      } catch {}
    };
    load();
  }, []);

  const cost = mode === "link" ? CREDIT_COSTS.URL_SCAN : CREDIT_COSTS.MESSAGE;
  const outOfCredits = credits && !credits.canAnalyze;
  const insufficient = credits && credits.remaining > 0 && credits.remaining < cost;

  const handleAnalyze = async () => {
    const text = input.trim();
    if (!text || (credits && credits.remaining < cost)) {
      if (credits && credits.remaining < cost) {
        toast({ title: "Not enough credits", description: `This crypto scan uses ${cost} credits.`, variant: "destructive" });
      }
      return;
    }

    setAnalyzing(true);
    setResult(null);
    try {
      let data;
      if (mode === "link") {
        const response = await base44.functions.invoke("scanUrl", { url: text });
        if (response.data?.error) throw new Error(response.data.error);
        data = response.data;
      } else {
        const response = await base44.functions.invoke("analyzeMessage", {
          mode: "crypto_investment",
          message_type: "crypto_investment",
          text,
          response_json_schema: RESPONSE_SCHEMA,
        });
        if (response.data?.error) throw new Error(response.data.error);
        data = response.data?.result || response.data;
      }

      await base44.entities.ScamAnalysis.create({
        message_text: mode === "link" ? text : redactMessage(text),
        message_type: mode === "link" ? "crypto_link" : "crypto_investment",
        submitted_by_senior: !!seniorLink,
        senior_id: seniorLink?.id,
        guardian_id: seniorLink?.guardian_id,
        risk_level: data.risk_level,
        risk_score: data.risk_score,
        explanation: data.explanation,
        tactics_detected: data.tactics_detected || [],
        next_steps: data.next_steps || [],
        what_they_want: data.what_they_want,
        why_scammers_do_this: data.why_scammers_do_this,
      });
      setCredits((prev) => prev
        ? { ...prev, remaining: typeof (data?.credits_remaining) === "number" ? data.credits_remaining : prev.remaining }
        : prev);
      if (typeof data?.credits_remaining !== "number") setCredits(await getCreditStatus());
      setResult(data);
    } catch (e) {
      toast({ title: "Crypto scan failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setInput("");
    setResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2 animate-slide-up">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <Bitcoin className="w-5 h-5 text-warning" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Crypto Scam Scanner</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Check a crypto link or investment message for phishing, giveaway, wallet-draining, and manipulation signals.
        </p>
      </div>

      {credits && !result && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{credits.isPaid ? `${credits.plan} plan` : "Starter plan"}</span>
          <span className="font-medium">{credits.remaining} credits left{credits.adminCreditBalance > 0 ? ` · ${credits.adminCreditBalance} bonus` : ""}</span>
        </div>
      )}

      {analyzing ? (
        <LongLoadingScreen type={mode === "link" ? "cryptoLink" : "cryptoInvestment"} />
      ) : result ? (
        <div className="space-y-5 animate-scale-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading">Crypto Scan Result</h2>
            <Button variant="outline" onClick={handleReset}>New Scan</Button>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">{mode === "link" ? "Crypto link" : "Investment message"}</p>
            <p className="text-sm font-mono break-all">{input}</p>
          </div>
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6">
            <CryptoScanResult result={result} mode={mode} />
          </div>
          <AIDisclaimer />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl animate-slide-up anim-delay-1">
            <button
              onClick={() => { setMode("link"); setInput(""); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "link" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <Link2 className="w-4 h-4" /> Crypto Link
            </button>
            <button
              onClick={() => { setMode("investment"); setInput(""); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "investment" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <TrendingUp className="w-4 h-4" /> Investment Message
            </button>
          </div>

          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6 space-y-4 animate-slide-up anim-delay-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {mode === "link" ? "Paste the crypto link" : "Paste the crypto investment message"}
              </label>
              {mode === "link" ? (
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://claim-token.example/..."
                  className="h-11 rounded-xl"
                  disabled={outOfCredits}
                />
              ) : (
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste the giveaway, airdrop, investment pitch, or crypto DM..."
                  className="min-h-[150px] rounded-xl"
                  disabled={outOfCredits}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {mode === "link" ? "Checks the destination with Vardin's existing URL threat-intelligence pipeline." : "Uses the same AI reasoning system as Message Check."} · {cost} credits
              </p>
            </div>

            {outOfCredits ? (
              <Link to="/pricing">
                <Button className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80">
                  <Crown className="w-4 h-4" /> Upgrade to scan
                </Button>
              </Link>
            ) : insufficient ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20 text-sm text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>You need {cost} credits but have {credits.remaining}.</span>
                <Link to="/pricing" className="underline ml-auto">Upgrade</Link>
              </div>
            ) : (
              <Button
                onClick={handleAnalyze}
                disabled={!input.trim() || analyzing}
                className="w-full h-11 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Scan Crypto · {cost} credits
              </Button>
            )}
          </div>

          <AIDisclaimer className="animate-fade-in anim-delay-3" />
        </div>
      )}
    </div>
  );
}