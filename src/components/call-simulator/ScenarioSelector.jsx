import React from "react";
import { Phone, ChevronRight, ShieldCheck } from "lucide-react";
import { SIMULATOR_SCENARIOS } from "@/lib/call-simulator-scenarios";

export default function ScenarioSelector({ onSelect }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <Phone className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold font-heading">Practice Call Simulator</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Roleplay against an AI scammer in a realistic phone call. After the call, you'll get a score on how well you identified and resisted their manipulative tactics.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Choose a scam scenario</p>
        {SIMULATOR_SCENARIOS.map((scenario, idx) => (
          <button
            key={scenario.id}
            onClick={() => onSelect(scenario)}
            className="w-full bg-card rounded-2xl border border-border/50 p-4 flex items-center gap-4 text-left hover:border-primary/30 hover:bg-muted/20 transition-all luxury-card-hover animate-slide-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${scenario.avatar_color} flex items-center justify-center text-2xl flex-shrink-0`}>
              {scenario.avatar_emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{scenario.title}</h3>
                <span className={`text-[10px] font-bold uppercase ${scenario.difficulty_color}`}>
                  {scenario.difficulty}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{scenario.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This is a <span className="font-semibold text-foreground">safe simulation</span>. No real scammer is calling you — the AI plays the scammer role for practice. Try different responses and learn from your score.
        </p>
      </div>
    </div>
  );
}