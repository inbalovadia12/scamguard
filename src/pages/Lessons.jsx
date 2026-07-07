import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, Crown, Sparkles, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import LockedFeature from "@/components/LockedFeature";
import LessonCard from "@/components/lessons/LessonCard";
import LessonView from "@/components/lessons/LessonView";
import LessonStats from "@/components/lessons/LessonStats";
import { LESSON_CATEGORIES, getIcon } from "@/lib/lessons";
import { getCreditStatus } from "@/lib/credits";
import { toast } from "@/components/ui/use-toast";

const ICON_MAP = {
  Mail: (props) => <svg {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  MessageSquare: (props) => <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  ShoppingCart: (props) => <svg {...props}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  TrendingUp: (props) => <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Users: (props) => <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Lock: (props) => <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Bot: (props) => <svg {...props}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
  QrCode: (props) => <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h7v7h-7z"/></svg>,
  ShieldCheck: (props) => <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
};

function CategoryIcon({ name, className }) {
  const Icon = ICON_MAP[name] || ICON_MAP.ShieldCheck;
  return <Icon className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
}

export default function Lessons() {
  const [credits, setCredits] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const init = async () => {
      const status = await getCreditStatus();
      setCredits(status);
      if (!status.isPremiumPlan) { setLoading(false); return; }

      try {
        const allProgress = await base44.entities.LessonProgress.list();
        setProgress(allProgress);
      } catch {}

      setLoading(false);
    };
    init();
  }, []);

  const getProgress = (lessonId) => progress.find((p) => p.lesson_id === lessonId);

  const totalXP = progress
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + (p.xp_earned || 0), 0);

  const allLessons = LESSON_CATEGORIES.flatMap((cat) =>
    cat.lessons.map((lesson) => ({ ...lesson, category: cat }))
  );

  const completedCount = progress.filter((p) => p.status === "completed").length;

  const handleStartLesson = (lesson, category) => {
    setActiveLesson(lesson);
    setActiveCategory(category);
  };

  const handleCompleteLesson = async (score, xp) => {
    try {
      const existing = getProgress(activeLesson.id);
      if (existing) {
        await base44.entities.LessonProgress.update(existing.id, {
          status: "completed",
          score,
          xp_earned: xp,
          completed_date: new Date().toISOString(),
        });
      } else {
        const created = await base44.entities.LessonProgress.create({
          lesson_id: activeLesson.id,
          category: activeCategory.id,
          status: "completed",
          score,
          xp_earned: xp,
          completed_date: new Date().toISOString(),
        });
        setProgress([...progress, created]);
      }

      if (existing) {
        setProgress(progress.map((p) =>
          p.id === existing.id
            ? { ...p, status: "completed", score, xp_earned: xp, completed_date: new Date().toISOString() }
            : p
        ));
      }

      setShowCelebration(true);
      setTimeout(() => {
        setShowCelebration(false);
        setActiveLesson(null);
        setActiveCategory(null);
      }, 2500);
    } catch (err) {
      toast({ title: "Could not save progress", description: err.message, variant: "destructive" });
      setActiveLesson(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (credits && !credits.isPremiumPlan) {
    return (
      <LockedFeature
        title="Premium Learning Center"
        description="Interactive lessons, quizzes, XP, and achievement badges to help you master scam detection. Available exclusively on Premium."
        buttonLabel="Upgrade to Premium"
        icon={GraduationCap}
      />
    );
  }

  if (activeLesson) {
    return (
      <div className="py-4">
        {showCelebration ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <Trophy className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold font-heading">Lesson Complete!</h2>
              <p className="text-muted-foreground">You earned {activeLesson.xp} XP</p>
            </div>
          </div>
        ) : (
          <LessonView
            lesson={activeLesson}
            onComplete={handleCompleteLesson}
            onExit={() => { setActiveLesson(null); setActiveCategory(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3 animate-slide-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <GraduationCap className="w-7 h-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Learning Center</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Master scam detection through interactive lessons and quizzes.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="animate-slide-up anim-delay-1">
        <LessonStats progress={progress} xp={totalXP} streak={1} />
      </div>

      {completedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card rounded-xl border border-border/50 p-3 animate-fade-in">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <span>You've completed {completedCount} of {allLessons.length} lessons. Keep it up!</span>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-8">
        {LESSON_CATEGORIES.map((category, catIdx) => (
          <div key={category.id} className="space-y-3 animate-slide-up" style={{ animationDelay: `${(catIdx + 2) * 80}ms` }}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center flex-shrink-0`}>
                <CategoryIcon name={category.icon} className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-base">{category.name}</h2>
                <p className="text-xs text-muted-foreground">{category.description}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {category.lessons.map((lesson, lessonIdx) => (
                <LessonCard
                  key={lesson.id}
                  category={category}
                  lesson={lesson}
                  progress={getProgress(lesson.id)}
                  isPremium={true}
                  onStart={(l) => handleStartLesson(l, category)}
                  index={lessonIdx}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Achievement badges preview */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-warning" />
          <h3 className="font-semibold text-sm">Achievement Badges</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "First Steps", desc: "Complete 1 lesson", unlocked: completedCount >= 1 },
            { label: "Getting Started", desc: "Complete 3 lessons", unlocked: completedCount >= 3 },
            { label: "Dedicated Learner", desc: "Complete 5 lessons", unlocked: completedCount >= 5 },
            { label: "Scam Expert", desc: "Complete all lessons", unlocked: completedCount >= allLessons.length },
          ].map((badge) => (
            <div
              key={badge.label}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                badge.unlocked
                  ? "border-warning/30 bg-warning/5 text-warning"
                  : "border-border/30 bg-muted/20 text-muted-foreground/50"
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 ${badge.unlocked ? "" : "opacity-40"}`} />
              <div>
                <div className="font-medium">{badge.label}</div>
                <div className="text-[10px] opacity-70">{badge.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}