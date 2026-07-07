import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, ChevronDown, ChevronUp, Ban, Phone, Flag, BookOpen, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import RiskBadge, { getRiskLevelFromScore, getRiskBarColor } from "@/components/scam/RiskBadge";
import TacticTag from "@/components/scam/TacticTag";

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

export default function AnalysisResult({ analysis, showEducation = true }) {
  const [speaking, setSpeaking] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);

  const riskScore = analysis.risk_score ?? 0;
  const derivedLevel = getRiskLevelFromScore(riskScore);

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

      {/* Explanation */}
      <div className="bg-muted/50 rounded-2xl p-5 space-y-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">What we found</h3>
        <p className="text-base leading-relaxed">{analysis.explanation}</p>
      </div>

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
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Manipulation tactics detected</h3>
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
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">What to do next</h3>
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

      {/* Education section */}
      {showEducation && analysis.why_scammers_do_this && (
        <div className="border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setEduOpen(!eduOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Learn more about this scam</span>
            </div>
            {eduOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {eduOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Why scammers use this tactic</h4>
                <p className="text-sm leading-relaxed">{analysis.why_scammers_do_this}</p>
              </div>
              {analysis.what_they_want && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">What they want from you</h4>
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

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        This analysis is for informational purposes only and does not constitute legal or financial advice.
        Results are based on pattern recognition and may not be 100% accurate.
      </p>
    </div>
  );
}