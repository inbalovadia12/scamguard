import React from "react";
import { Trophy, CheckCircle2, AlertTriangle, RotateCcw, ChevronRight, Target, ShieldCheck, Swords, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_ICONS = {
  "Information Protection": ShieldCheck,
  "Tactic Recognition": Target,
  "Resistance & Pushback": Swords,
  "Call Handling": PhoneOff,
};

const GRADE_COLORS = {
  "A+": "text-success",
  "A": "text-success",
  "B+": "text-primary",
  "B": "text-primary",
  "C+": "text-warning",
  "C": "text-warning",
  "D": "text-destructive",
  "F": "text-destructive",
};

const scoreColor = (score) => (score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive");
const barColor = (score) => (score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-destructive");

export default function CallScoreCard({ scenario, score, onRetry, onBackToScenarios }) {
  const gradeColor = GRADE_COLORS[score.grade] || "text-muted-foreground";

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Overall score header */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
          <Trophy className="w-8 h-8 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{scenario.title} — Call Results</p>
          <div className="flex items-baseline justify-center gap-2 mt-1">
            <span className={`text-4xl font-bold ${scoreColor(score.overall_score)}`}>{score.overall_score}</span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
          <span className={`inline-block text-lg font-bold ${gradeColor} mt-1`}>Grade: {score.grade}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{score.summary}</p>
      </div>

      {/* Breakdown */}
      {score.breakdown?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Score Breakdown
          </h3>
          <div className="space-y-3.5">
            {score.breakdown.map((item, i) => {
              const Icon = CATEGORY_ICONS[item.category] || Target;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{item.category}</span>
                    </div>
                    <span className={`text-sm font-bold ${scoreColor(item.score)}`}>{item.score}/100</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor(item.score)} rounded-full transition-all duration-700`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.feedback}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tactics encountered */}
      {score.tactics_encountered?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-2.5">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Swords className="w-4 h-4 text-destructive" />
            Tactics Used Against You
          </h3>
          <div className="flex flex-wrap gap-2">
            {score.tactics_encountered.map((tactic, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/5 border border-destructive/15 text-xs font-medium text-destructive">
                {tactic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="grid sm:grid-cols-2 gap-3">
        {score.strengths?.length > 0 && (
          <div className="bg-success/5 rounded-2xl border border-success/20 p-4 space-y-2">
            <h4 className="font-semibold text-xs text-success flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              What You Did Well
            </h4>
            <ul className="space-y-1.5">
              {score.strengths.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-success mt-1.5 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {score.improvements?.length > 0 && (
          <div className="bg-warning/5 rounded-2xl border border-warning/20 p-4 space-y-2">
            <h4 className="font-semibold text-xs text-warning flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              What to Improve
            </h4>
            <ul className="space-y-1.5">
              {score.improvements.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-warning mt-1.5 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tips for this scenario */}
      <div className="bg-primary/5 rounded-2xl border border-primary/15 p-4 space-y-2">
        <h4 className="font-semibold text-xs text-primary uppercase tracking-wider">Key Tips for {scenario.title}</h4>
        <ul className="space-y-1.5">
          {scenario.tips.map((tip, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
              <ChevronRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <Button onClick={onRetry} className="flex-1 gap-2">
          <RotateCcw className="w-4 h-4" />
          Try This Scenario Again
        </Button>
        <Button onClick={onBackToScenarios} variant="outline" className="flex-1 gap-2">
          <ChevronRight className="w-4 h-4 rotate-180" />
          Choose Different Scenario
        </Button>
      </div>
    </div>
  );
}