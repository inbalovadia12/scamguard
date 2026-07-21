import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, Loader2, ArrowRight, MessageSquare, Mail, Briefcase, ShoppingCart,
  Heart, Landmark, HelpCircle, Lock, Link2, TrendingUp, Package, Gift, HeartHandshake, Globe,
  AlertTriangle, Crown,
} from "lucide-react";
import { Link } from "react-router-dom";
import TruncatedText from "@/components/TruncatedText";
import AnalysisResult from "@/components/scam/AnalysisResult";
import CommunityDataToggle from "@/components/community/CommunityDataToggle";
import ConsentBanner from "@/components/family/ConsentBanner";
import { getCreditStatus, incrementCreditUsage, CREDIT_COSTS, getCachedAnalysis, cacheAnalysis } from "@/lib/credits";
import { redactMessage } from "@/lib/redact";
import { getSeniorLink } from "@/lib/guardianAlerts";
import LongLoadingScreen from "@/components/LongLoadingScreen";

const messageTypes = [
  { value: "sms", label: "SMS / Text", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "job_offer", label: "Job Offer", icon: Briefcase },
  { value: "marketplace", label: "Marketplace Listing", icon: ShoppingCart },
  { value: "romance", label: "Romance / Dating", icon: Heart },
  { value: "bank_government", label: "Bank / Government", icon: Landmark },
  { value: "tech_support", label: "Tech Support", icon: HelpCircle },
  { value: "crypto_investment", label: "Crypto / Investment", icon: TrendingUp },
  { value: "delivery", label: "Package Delivery", icon: Package },
  { value: "lottery_prize", label: "Lottery / Prize", icon: Gift },
  { value: "charity", label: "Charity / Donation", icon: HeartHandshake },
  { value: "other", label: "Other", icon: ShieldCheck },
];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number" },
    explanation: { type: "string" },
    tactics_detected: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    why_scammers_do_this: { type: "string" },
    what_they_want: { type: "string" },
    what_to_say: { type: "string" },
  },
};

export default function Home() {
  const [mode, setMode] = useState("message");
  const [messageText, setMessageText] = useState("");
  const [urlText, setUrlText] = useState("");
  const [messageType, setMessageType] = useState("sms");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [credits, setCredits] = useState(null);
  const [seniorLink, setSeniorLink] = useState(null);

  useEffect(() => {
    const load = async () => {
      const status = await getCreditStatus();
      setCredits(status);
      const user = await base44.auth.me();
      setSeniorLink(await getSeniorLink(user.id));
    };
    load();
  }, []);

  const handleAnalyze = async () => {
    const input = mode === "url" ? urlText.trim() : messageText.trim();
    if (!input) return;
    const cost = mode === "url" ? CREDIT_COSTS.URL_SCAN : CREDIT_COSTS.MESSAGE;
    if (credits && credits.remaining < cost) return;

    // Check cache first
    const cached = getCachedAnalysis(input);
    if (cached) {
      setResult(cached);
      return;
    }

    setAnalyzing(true);
    setResult(null);

    let llmResult;
    if (mode === "url") {
      const response = await base44.functions.invoke("scanUrl", { url: input });
      llmResult = response.data;
    } else {
      llmResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Scam detection expert: analyze this ${messageType} message for scam risk.\nMessage: "${input}"\nRules: never say "definitely a scam" (use "likely"); plain English; educational. Name manipulation tactics when applicable (e.g. Urgency, Authority Impersonation, Scarcity, Love Bombing, Payment Red Flags) and concrete next steps (e.g. Do not reply, Block sender, Report to carrier).`,
        response_json_schema: RESPONSE_SCHEMA,
      });
    }

    const analysisType = mode === "url" ? "url" : messageType;
    await base44.entities.ScamAnalysis.create({
      message_text: mode === "url" ? input : redactMessage(input),
      message_type: analysisType,
      submitted_by_senior: !!seniorLink,
      senior_id: seniorLink?.id,
      ...llmResult,
    });

    cacheAnalysis(input, llmResult);
    await incrementCreditUsage(cost);
    setCredits(await getCreditStatus());
    setResult(llmResult);
    setAnalyzing(false);
  };

  const handleReset = () => {
    setMessageText("");
    setUrlText("");
    setResult(null);
  };

  const outOfCredits = credits && !credits.canAnalyze;
  const urlLocked = credits && !credits.isPaid;
  const currentCost = mode === "url" ? CREDIT_COSTS.URL_SCAN : CREDIT_COSTS.MESSAGE;
  const insufficientCredits = credits && credits.remaining > 0 && credits.remaining < currentCost;
  const urlCost = CREDIT_COSTS.URL_SCAN;

  return (
    <div className="max-w-2xl mx-auto">
      <ConsentBanner />

      {credits && !result && (
        <div className="flex items-center justify-between mb-4 sm:mb-6 px-4 py-2.5 bg-muted rounded-xl animate-fade-in">
          <span className="text-sm text-muted-foreground">
            {credits.isPaid ? "✦ " + (credits.plan === "premium" ? "Premium" : "Plus") + " plan" : "Starter plan"}
          </span>
          <span className="text-sm font-medium">
            {credits.remaining} / {credits.limit} credits left
          </span>
        </div>
      )}

      {credits?.lowCredit && !outOfCredits && !result && (
        <div className="mb-4 sm:mb-6 flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/20 rounded-xl animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-warning">Running low on credits</p>
            <p className="text-xs text-muted-foreground">Only {credits.remaining} credits left. Consider upgrading for more analyses.</p>
          </div>
          <Link to="/pricing" className="flex-shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5 border-warning/30 text-warning hover:bg-warning/10">
              <Crown className="w-3.5 h-3.5" />
              Upgrade
            </Button>
          </Link>
        </div>
      )}

      {insufficientCredits && !result && !outOfCredits && (
        <div className="mb-4 sm:mb-6 flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/20 rounded-xl animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-warning">Not enough credits for this action</p>
            <p className="text-xs text-muted-foreground">
              This {mode === "url" ? "URL scan" : "analysis"} costs {currentCost} credits but you only have {credits.remaining} left.
            </p>
          </div>
          <Link to="/pricing" className="flex-shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5 border-warning/30 text-warning hover:bg-warning/10">
              <Crown className="w-3.5 h-3.5" />
              Upgrade
            </Button>
          </Link>
        </div>
      )}

      {outOfCredits && !result && (
        <div className="mb-6 p-6 rounded-2xl bg-warning/10 border border-warning/20 text-center space-y-5 animate-scale-in">
          <div className="space-y-3">
            <Lock className="w-8 h-8 text-warning mx-auto" />
            <h3 className="font-semibold">You're out of AI credits</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You've used all {credits.limit} of your monthly credits. Upgrade for more analyses, URL scanning, AI chat, and family protection.
            </p>
          </div>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              <ShieldCheck className="w-4 h-4" />
              Upgrade Now
            </Button>
          </Link>
        </div>
      )}

      {analyzing ? (
        <LongLoadingScreen type={mode === "url" ? "url" : "message"} />
      ) : !result ? (
        <div className="space-y-5 sm:space-y-8">
          <div className="text-center space-y-2 sm:space-y-3 animate-slide-up">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Check Before You Click</h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto hidden sm:block">
              Paste a message or link and get an instant scam risk assessment.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl animate-slide-up anim-delay-1">
            <button
              onClick={() => setMode("message")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === "message" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Message
            </button>
            <button
              onClick={() => setMode("url")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === "url" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <Link2 className="w-4 h-4" />
              Link / URL
              {urlLocked && <Lock className="w-3 h-3 text-warning" />}
            </button>
          </div>

          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5 animate-slide-up anim-delay-2">
            {mode === "message" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message Type</label>
                  <Select value={messageType} onValueChange={setMessageType}>
                    <SelectTrigger className="h-11 sm:h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {messageTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="w-4 h-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Paste the message</label>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && (file.type.startsWith("text/") || file.type === "application/json")) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setMessageText(ev.target.result);
                        reader.readAsText(file);
                      }
                    }}
                    placeholder="Paste the suspicious message here, or drag & drop a text file..."
                    className="min-h-[110px] sm:min-h-[160px] text-base resize-none rounded-xl"
                    disabled={outOfCredits}
                  />
                </div>
              </>
            ) : urlLocked ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-warning/10 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-warning" />
                </div>
                <h3 className="font-semibold">URL Scanning is a paid feature</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Scan any link against live web data — domain reputation, typosquatting, and known scam reports. Available on Plus and Premium plans.
                </p>
                <Link to="/pricing">
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-primary/80">
                    Upgrade to Unlock
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Paste the link
                </label>
                <Input
                  value={urlText}
                  onChange={(e) => setUrlText(e.target.value)}
                  onDrop={(e) => {
                    const text = e.dataTransfer.getData("text/plain");
                    if (text) { e.preventDefault(); setUrlText(text.trim()); }
                  }}
                  placeholder="https://suspicious-link.com/... or drag a URL here"
                  className="h-11 sm:h-12 text-base rounded-xl"
                  disabled={outOfCredits}
                />
                <p className="text-xs text-muted-foreground">
                   We fetch the actual website content and analyze it for scams. Uses {urlCost} credits.
                 </p>
              </div>
            )}

            {!(mode === "url" && urlLocked) && (
              <Button
                onClick={handleAnalyze}
                disabled={(mode === "url" ? !urlText.trim() : !messageText.trim()) || analyzing || outOfCredits || insufficientCredits}
                className="w-full h-11 sm:h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20"
                size="lg"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {mode === "url" ? "Scanning link..." : "Analyzing message..."}
                  </>
                ) : (
                  <>
                    {mode === "url" ? `Scan Link · ${urlCost} credits` : `Analyze Message · ${CREDIT_COSTS.MESSAGE} credits`}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground animate-fade-in anim-delay-3">
            <span>🔒 Auto-redacted before storage</span>
            <span>⚡ Instant AI analysis</span>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-3 animate-fade-in anim-delay-3">
            <CommunityDataToggle />
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-scale-in">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight font-heading">Analysis Result</h1>
            <Button variant="outline" onClick={handleReset}>Check another</Button>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {mode === "url" ? "Scanned link" : "Original message"}
            </h3>
            <TruncatedText
              text={mode === "url" ? urlText : messageText}
              maxChars={mode === "url" ? 80 : 120}
              className="text-muted-foreground"
            />
          </div>

          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6">
            <AnalysisResult analysis={result} messageType={mode === "url" ? "url" : messageType} />
          </div>
        </div>
      )}
    </div>
  );
}