import React from "react";
import { AlertTriangle, Target, ShieldX, Sparkles } from "lucide-react";
import { useKidMode } from "@/lib/KidModeContext";

// Structured, labeled threat breakdown shown on scan results.
export default function ThreatExplanation({ analysis }) {
  const { kidMode } = useKidMode();

  const sections = [
    { key: "why", label: kidMode ? "Why it seems fishy" : "Why this is suspicious", icon: AlertTriangle, value: analysis.explanation, color: "text-warning" },
    { key: "wants", label: kidMode ? "What they're after" : "What the scammer wants", icon: Target, value: analysis.what_they_want, color: "text-destructive" },
    { key: "avoid", label: kidMode ? "What not to do" : "What to avoid", icon: ShieldX, value: avoidText(analysis, kidMode), color: "text-primary" },
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

function avoidText(analysis, kidMode) {
  if (analysis.what_to_say) return analysis.what_to_say;
  if (kidMode) return "Don't reply, don't share your info, and tell a grown-up right away.";
  return "Don't reply, don't share personal or payment details, and don't click any links.";
}