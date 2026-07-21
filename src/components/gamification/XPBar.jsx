import React from "react";
import { useGamification } from "@/hooks/useGamification";

export default function XPBar() {
  const { xp, level, nextLevel, progressToNext, loading } = useGamification();

  if (loading) return null;

  return (
    <div className="mx-4 mb-2 px-4 py-3 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/15">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{level.icon}</span>
          <span className="text-sm font-bold text-primary">{level.name}</span>
        </div>
        {nextLevel && (
          <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
            {xp}/{nextLevel.minXp} XP
          </span>
        )}
      </div>
      {nextLevel ? (
        <>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {nextLevel.minXp - xp} XP to {nextLevel.name}
          </p>
        </>
      ) : (
        <p className="text-[10px] text-primary font-medium">Max level reached! 👑</p>
      )}
    </div>
  );
}