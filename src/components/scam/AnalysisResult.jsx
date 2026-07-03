import React, { useState } from "react";
import { Volume2, VolumeX, ChevronDown, ChevronUp, Ban, Phone, Flag, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import RiskBadge from "@/components/scam/RiskBadge";
import TacticTag from "@/components/scam/TacticTag";

const stepIcons = {
  "Do not reply": Ban,
  "Block sender": Phone,
  "Report to carrier": Flag,
};

export default function AnalysisResult({ analysis, showEducation = true }) {
  const [speaking, setSpeaking] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);

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
    <div className="space-y-6">
      {/* Risk Level */}
      <div className="flex items-center justify-between">
        <RiskBadge level={analysis.risk_level} size="lg" />
        <Button variant="outline" size="sm" onClick={handleSpeak} className="gap-2">
          {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {speaking ? "Stop" : "Listen"}
        </Button>
      </div>

      {/* Score bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Risk Score</span>
          <span className="font-semibold">{analysis.risk_score}/100</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              analysis.risk_score >= 70 ? "bg-destructive" : analysis.risk_score >= 40 ? "bg-warning" : "bg-success"
            }`}
            style={{ width: `${analysis.risk_score}%` }}
          />
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-muted rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">What we found</h3>
        <p className="text-base leading-relaxed">{analysis.explanation}</p>
      </div>

      {/* Tactics */}
      {analysis.tactics_detected?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Manipulation tactics detected</h3>
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
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">What to do next</h3>
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
            className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
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
                  <p className="text-sm leading-relaxed italic bg-muted p-3 rounded-xl">&ldquo;{analysis.what_to_say}&rdquo;</p>
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