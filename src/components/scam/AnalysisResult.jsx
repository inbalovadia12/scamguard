import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, ChevronDown, ChevronUp, Ban, Phone, Flag, BookOpen, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import RiskBadge, { getRiskLevelFromScore, getRiskBarColor } from "@/components/scam/RiskBadge";
import TacticTag from "@/components/scam/TacticTag";
import ThreatExplanation from "@/components/scam/ThreatExplanation";
import ResultActions from "@/components/scam/ResultActions";
import CommunityIntel from "@/components/community/CommunityIntel";
import { useKidMode } from "@/lib/KidModeContext";

const MESSAGE_TYPE_TO_SCAM = {
  sms: "smishing",
  email: "phishing_email",
  job_offer: "fake_job",
  marketplace: "marketplace",
  romance: "romance",
  bank_government: "bank_impersonation",
  tech_support: "tech_support",
  crypto_investment: "crypto_investment",
  delivery: "delivery",
  lottery_prize: "lottery_prize",
  charity: "other",
};

const stepIcons = {
  "Do not reply": Ban,
  "Block sender": Phone,
  "Report to carrier": Flag,
};

function AnimatedScoreBar({ score }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const barColor = getRiskBarColor(score);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-muted-foreground">Risk Score</span>
        <span className="text-2xl font-bold font-heading tabular-nums">
          <AnimatedNumber value={animatedScore} />
          <span className="text-sm text-muted-foreground font-normal">/100</span>
        </span>
      </div>
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-[1200ms] ease-out ${barColor}`}
          style={{ width: `${animatedScore}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/20 transition-all duration-[1200ms] ease-out"
          style={{ left: `${animatedScore}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60 font-medium px-0.5">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
        <span>Critical</span>
      </div>
    </div>
  );
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span>{display}</span>;
}

export default function AnalysisResult({ analysis, showEducation = true, messageType, originalMessage }) {
  const { kidMode } = useKidMode();
  const [speaking, setSpeaking] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);

  const riskScore = analysis.risk_score ?? 0;
  const derivedLevel = getRiskLevelFromScore(riskScore);
  const isLowRisk = derivedLevel === "low";
  const isHighRisk = derivedLevel === "high";

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = `Risk level: ${analysis.risk_level}. ${analysis.explanation}. Recommended actions: ${(analysis.next_steps || []).join(". ")}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <div className="space-y-5">
      {analysis._cached && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
          <ShieldX className="w-3.5 h-3.5" />
          Result from cache — no credits were used for this analysis.
        </div>
      )}

      {/* Risk Header */}
      <div className="flex items-center justify-between">
        <RiskBadge level={derivedLevel} size="lg" />
        <Button variant="outline" size="sm" onClick={handleSpeak} className="gap-2">
          {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {speaking ? "Stop" : "Listen"}
        </Button>
      </div>

      {/* Score bar */}
      <AnimatedScoreBar score={riskScore} />

      {/* Structured threat breakdown */}
      <ThreatExplanation analysis={analysis} />

      {/* URLhaus diagnostic — temporary verification of the live threat-intelligence integration */}
      {analysis.urlhaus && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URLhaus diagnostic</span>
            <span className={`text-xs font-semibold ${analysis.urlhaus.listed ? "text-destructive" : "text-emerald-600"}`}>
              {analysis.urlhaus.listed ? "LISTED" : "NOT LISTED"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Integration response received: <span className="font-medium text-foreground">Yes</span></div>
            {analysis.urlhaus.threat && <div>Threat: <span className="font-medium text-foreground">{analysis.urlhaus.threat}</span></div>}
            {analysis.urlhaus.url_status && <div>URL status: <span className="font-medium text-foreground">{analysis.urlhaus.url_status}</span></div>}
            {analysis.urlhaus.date_added && <div>Date added: <span className="font-medium text-foreground">{analysis.urlhaus.date_added}</span></div>}
            {Array.isArray(analysis.urlhaus.tags) && analysis.urlhaus.tags.length > 0 && <div>Tags: <span className="font-medium text-foreground">{analysis.urlhaus.tags.join(", ")}</span></div>}
          </div>
        </div>
      )}

      {/* Marketplace info */}
      {analysis.marketplace_platform && (
        <div className="flex items-center gap-2 text-sm bg-primary/5 rounded-xl px-4 py-3 border border-primary/10">
          <span className="text-muted-foreground">Detected platform:</span>
          <span className="font-semibold text-primary">{analysis.marketplace_platform}</span>
        </div>
      )}

      {/* Tactics */}
      {analysis.tactics_detected?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{kidMode ? "Tricky things we noticed" : "Manipulation tactics detected"}</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.tactics_detected.map((tactic) => (
              <TacticTag key={tactic} tactic={tactic} />
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {analysis.next_steps?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{kidMode ? "What you should do" : "What to do next"}</h3>
          <div className="space-y-2">
            {analysis.next_steps.map((step, i) => {
              const Icon = stepIcons[step] || Flag;
              return (
                <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ask Family + Report Scam actions (medium/high risk) */}
      <ResultActions analysis={analysis} analysisType="scam_analysis" messageType={messageType} originalMessage={originalMessage} />

      {/* Education section */}
      {showEducation && !kidMode && (analysis.why_scammers_do_this || analysis.what_they_want || analysis.what_to_say) && (
        <div className="border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setEduOpen(!eduOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{isLowRisk ? "Learn more about this result" : "Learn more about this analysis"}</span>
            </div>
            {eduOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {eduOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
              {analysis.why_scammers_do_this && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    {isLowRisk ? "Why this looks safe" : isHighRisk ? "Why scammers may use this tactic" : "Why we're cautious"}
                  </h4>
                  <p className="text-sm leading-relaxed">{analysis.why_scammers_do_this}</p>
                </div>
              )}
              {analysis.what_they_want && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    {isLowRisk ? "What we found" : isHighRisk ? "What they may want from you" : "What this may be about"}
                  </h4>
                  <p className="text-sm leading-relaxed">{analysis.what_they_want}</p>
                </div>
              )}
              {analysis.what_to_say && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">What to say if contacted again</h4>
                  <p className="text-sm leading-relaxed italic bg-muted/50 p-3 rounded-xl">&ldquo;{analysis.what_to_say}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Community Intel */}
      {!kidMode && messageType && MESSAGE_TYPE_TO_SCAM[messageType] && (
        <div className="border-t border-border/50 pt-4">
          <CommunityIntel scamTypes={[MESSAGE_TYPE_TO_SCAM[messageType]]} />
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {kidMode ? "We do our best to keep you safe, but always ask a grown-up if you're not sure!" : "This analysis is for informational purposes only and does not constitute legal or financial advice. Results are based on pattern recognition and may not be 100% accurate."}
      </p>
    </div>
  );
}