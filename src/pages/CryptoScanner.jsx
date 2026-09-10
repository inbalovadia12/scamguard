import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bitcoin, Wallet, TrendingUp, Crown, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import AIDisclaimer from "@/components/AIDisclaimer";
import CryptoScanResult from "@/components/scam/CryptoScanResult";
import { getCreditStatus, incrementCreditUsage, CREDIT_COSTS } from "@/lib/credits";
import { getSeniorLink } from "@/lib/guardianAlerts";
import { redactMessage } from "@/lib/redact";
import { useToast } from "@/components/ui/use-toast";

const BLOCKCHAINS = ["Ethereum", "BSC", "Solana", "Polygon", "Base", "Arbitrum", "Other"];

export default function CryptoScanner() {
  const { toast } = useToast();
  const [mode, setMode] = useState("address");
  const [input, setInput] = useState("");
  const [blockchain, setBlockchain] = useState("Ethereum");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [credits, setCredits] = useState(null);
  const [seniorLink, setSeniorLink] = useState(null);

  useEffect(() => {
    const load = async () => {
      setCredits(await getCreditStatus());
      const user = await base44.auth.me();
      setSeniorLink(await getSeniorLink(user.id));
    };
    load();
  }, []);

  const cost = CREDIT_COSTS.URL_SCAN;
  const outOfCredits = credits && !credits.canAnalyze;
  const insufficient = credits && credits.remaining > 0 && credits.remaining < cost;

  const handleAnalyze = async () => {
    const text = input.trim();
    if (!text) return;
    if (credits && credits.remaining < cost) {
      toast({ title: "Not enough credits", description: `Crypto scans use ${cost} credits.`, variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      let data;
      if (mode === "investment") {
        // IMPORTANT: Investment messages intentionally use the SAME AI agent,
        // model, and message-check prompt as Home.jsx. Crypto only changes the
        // response schema/UI — it must not use a separate crypto reasoning prompt.
        const CRYPTO_MESSAGE_RESPONSE_SCHEMA = {
          type: "object",
          properties: {
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            risk_score: { type: "number", description: "0-100 risk score. Low risk = 0-35, Medium risk = 36-70, High risk = 71-100. Must match the risk_level. Vary the score based on actual danger — do not default to a fixed number." },
            explanation: { type: "string" },
            is_likely_scam: { type: "boolean" },
            contract_verified: { type: "boolean" },
            honeypot_risk: { type: "string", enum: ["low", "medium", "high"] },
            rug_pull_risk: { type: "string", enum: ["low", "medium", "high"] },
            liquidity_status: { type: "string" },
            red_flags: { type: "array", items: { type: "string" } },
            tactics_detected: { type: "array", items: { type: "string" } },
            what_they_want: { type: "string" },
            why_scammers_do_this: { type: "string" },
            what_to_say: { type: "string" },
            next_steps: { type: "array", items: { type: "string" } },
            sources: { type: "array", items: { type: "string" } },
          },
        };
        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Scam detection expert: analyze this crypto_investment message for scam risk.\nMessage: "${text}"\nRules: never say "definitely a scam" (use "likely"); plain English; educational. Name manipulation tactics when applicable (e.g. Urgency, Authority Impersonation, Scarcity, Love Bombing, Payment Red Flags) and concrete next steps (e.g. Do not reply, Block sender, Report to carrier).\n\nRISK SCORE: Set risk_score as a whole number 0-100 that reflects the ACTUAL danger of this message. Low risk = 0-35, Medium risk = 36-70, High risk = 71-100. The score MUST match the risk_level. Do NOT default to 10 or any fixed number — vary it based on how many scam indicators are present and how severe they are.`,
          response_json_schema: CRYPTO_MESSAGE_RESPONSE_SCHEMA,
        });
        data = llmResult;
      } else {
        const res = await base44.functions.invoke("scanCrypto", {
          mode,
          input: text,
          blockchain: mode === "address" ? blockchain : undefined,
        });
        data = res.data;
      }
      await base44.entities.ScamAnalysis.create({
        message_text: redactMessage(text),
        message_type: "crypto_investment",
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
      await incrementCreditUsage(cost);
      setCredits(await getCreditStatus());
      setResult(data);
    } catch (e) {
      toast({ title: "Scan failed", description: e.message || "Try again.", variant: "destructive" });
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
          Check a wallet/contract address or an "investment opportunity" against live on-chain and scam-report data.
        </p>
      </div>

      {credits && !result && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{credits.isPaid ? `${credits.plan} plan` : "Starter plan"}</span>
          <span className="font-medium">{credits.remaining} / {credits.limit} credits left</span>
        </div>
      )}

      {analyzing ? (
        <LongLoadingScreen type="url" />
      ) : result ? (
        <div className="space-y-5 animate-scale-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading">Crypto Scan Result</h2>
            <Button variant="outline" onClick={handleReset}>New Scan</Button>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">
              {mode === "address" ? "Address / Contract" : "Investment content"}
            </p>
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
              onClick={() => setMode("address")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "address" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <Wallet className="w-4 h-4" /> Address
            </button>
            <button
              onClick={() => setMode("investment")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "investment" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <TrendingUp className="w-4 h-4" /> Investment
            </button>
          </div>

          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6 space-y-4 animate-slide-up anim-delay-2">
            {mode === "address" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Blockchain</label>
                <Select value={blockchain} onValueChange={setBlockchain}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKCHAINS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {mode === "address" ? "Wallet or contract address" : "Paste the investment offer / message"}
              </label>
              {mode === "address" ? (
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="0x..."
                  className="h-11 font-mono rounded-xl"
                  disabled={outOfCredits}
                />
              ) : (
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste the DM, giveaway link, or token pitch..."
                  className="min-h-[120px] rounded-xl"
                  disabled={outOfCredits}
                />
              )}
              <p className="text-xs text-muted-foreground">Uses live web data · {cost} credits</p>
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