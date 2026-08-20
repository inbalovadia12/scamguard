import React from "react";
import { AlertTriangle, Target, ShieldX, Sparkles, ShieldCheck } from "lucide-react";
import { useKidMode } from "@/lib/KidModeContext";

// Structured, labeled threat breakdown shown on scan results.
export default function ThreatExplanation({ analysis }) {
  const { kidMode } = useKidMode();
  const risk = analysis.risk_level || getRiskLevelFromScore(analysis.risk_score);
  const isLow = risk === "low";
  const isHigh = risk === "high";

  const sections = [
    {
      key: "why",
      label: kidMode
        ? (isLow ? "Why it looks okay" : isHigh ? "Why it looks risky" : "Why we're being careful")
        : (isLow ? "Why this looks safe" : isHigh ? "Why this looks risky" : "Why we're cautious"),
      icon: isLow ? ShieldCheck : AlertTriangle,
      value: analysis.explanation,
      color: isLow ? "text-success" : "text-warning",
    },
    {
      key: "wants",
      label: kidMode
        ? (isLow ? "What we found" : "What they may be after")
        : (isLow ? "What we found" : isHigh ? "What they're trying to do" : "What this may be about"),
      icon: Target,
      value: analysis.what_they_want,
      color: isHigh ? "text-destructive" : "text-primary",
    },
    {
      key: "avoid",
      label: kidMode
        ? (isLow ? "Good to know" : "What not to do")
        : (isLow ? "Good to know" : "What to avoid"),
      icon: ShieldX,
      value: avoidText(analysis, kidMode, isLow),
      color: "text-primary",
    },
  ].filter((s) => s.value);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          {kidMode ? "Here's what we found" : "Threat Breakdown"}
        </h3>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="bg-muted/40 rounded-2xl p-4 border border-border/40 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
              </div>
              <p className="text-sm leading-relaxed">{s.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function avoidText(analysis, kidMode, isLow) {
  if (analysis.what_to_say) return analysis.what_to_say;
  if (isLow) return kidMode ? "It looks okay, but ask a grown-up if anything still feels wrong." : "No major warning signs were found. Stay cautious with unexpected requests or links.";
  if (kidMode) return "Don't reply, don't share your info, and tell a grown-up right away.";
  return "Don't reply, don't share personal or payment details, and don't click any links.";
}

function getRiskLevelFromScore(score) {
  const n = Number(score ?? 0);
  if (n >= 71) return "high";
  if (n >= 36) return "medium";
  return "low";
}