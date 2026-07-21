import React from "react";
import { useGamification, BADGES } from "@/hooks/useGamification";
import { Flame, Award } from "lucide-react";

export default function StreakBadges() {
  const { streak, earnedBadges, loading } = useGamification();

  if (loading) return null;

  const streakMessage =
    streak === 0
      ? "Run a scan to start your streak!"
      : streak < 7
      ? "Keep going — aim for a 7-day streak!"
      : streak < 30
      ? "You're on fire! 30 days for the Scam Slayer badge."
      : "Incredible dedication! You're a Scam Slayer! ⚔️";

  return (
    <div className="grid sm:grid-cols-2 gap-4 animate-slide-up anim-delay-3">
      {/* Streak card */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-warning" />
          <h2 className="font-semibold text-sm font-heading">Scam-Spotter Streak</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-heading text-warning tabular-nums">{streak}</span>
          <span className="text-sm text-muted-foreground">day{streak !== 1 ? "s" : ""}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{streakMessage}</p>
      </div>

      {/* Badges card */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm font-heading">
            Badges <span className="text-muted-foreground font-normal">({earnedBadges.length}/{BADGES.length})</span>
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {BADGES.map((badge) => {
            const earned = earnedBadges.some((b) => b.id === badge.id);
            return (
              <div
                key={badge.id}
                title={`${badge.name} — ${badge.desc}`}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all ${
                  earned ? "bg-primary/10" : "bg-muted/40 opacity-40 grayscale"
                }`}
              >
                <span className="text-xl">{badge.icon}</span>
                <span className="text-[9px] font-medium leading-tight">{badge.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}