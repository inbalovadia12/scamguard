import React from "react";
import { CheckCircle2, Circle, Lock, Play, Award } from "lucide-react";

export default function LessonCard({ category, lesson, progress, isPremium, onStart, index }) {
  const status = progress?.status || "not_started";
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const isLocked = !isPremium;

  return (
    <button
      onClick={() => !isLocked && onStart(lesson)}
      disabled={isLocked}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 animate-slide-up ${
        isLocked
          ? "border-border/30 bg-muted/30 cursor-not-allowed opacity-60"
          : isCompleted
          ? "border-success/20 bg-success/5 hover:border-success/40"
          : "border-border/50 bg-card hover:border-primary/30 hover:shadow-md"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isCompleted ? "bg-success/10" : `bg-gradient-to-br ${category.color}`
        }`}>
          {isLocked ? (
            <Lock className="w-5 h-5 text-muted-foreground" />
          ) : isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : isInProgress ? (
            <Play className="w-5 h-5 text-white" />
          ) : (
            <Circle className="w-5 h-5 text-white/80" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{lesson.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Award className="w-3 h-3" />
              {lesson.xp} XP
            </span>
            {isInProgress && (
              <span className="text-xs text-primary font-medium">In progress</span>
            )}
            {isCompleted && progress?.score != null && (
              <span className="text-xs text-success font-medium">{progress.score}% score</span>
            )}
          </div>
        </div>
        {!isLocked && !isCompleted && (
          <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    </button>
  );
}