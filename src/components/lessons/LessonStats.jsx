import React from "react";
import { Award, CheckCircle2, Flame, Star, TrendingUp } from "lucide-react";

export default function LessonStats({ progress, xp, streak }) {
  const completedCount = progress.filter((p) => p.status === "completed").length;
  const totalCount = progress.length;
  const avgScore = completedCount > 0
    ? Math.round(
        progress
          .filter((p) => p.status === "completed" && p.score != null)
          .reduce((sum, p, _, arr) => sum + p.score / arr.length, 0)
      )
    : 0;

  const stats = [
    {
      label: "Completed",
      value: `${completedCount}/${totalCount}`,
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Total XP",
      value: xp,
      icon: Star,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Day Streak",
      value: streak,
      icon: Flame,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Avg Score",
      value: avgScore > 0 ? `${avgScore}%` : "—",
      icon: TrendingUp,
      color: "text-chart-5",
      bg: "bg-chart-5/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card rounded-2xl border border-border/50 p-4 text-center space-y-2">
          <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mx-auto`}>
            <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
          </div>
          <div>
            <div className="text-xl font-bold font-heading tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}