import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { GraduationCap, Loader2, Crown, Sparkles, Trophy, Phone, ChevronRight, Scan, Target, Flame, Star, Check, Play } from "lucide-react";
import { Link } from "react-router-dom";
import LockedFeature from "@/components/LockedFeature";
import LessonCard from "@/components/lessons/LessonCard";
import LessonView from "@/components/lessons/LessonView";
import LessonStats from "@/components/lessons/LessonStats";
import { LESSON_CATEGORIES } from "@/lib/lessons";
import { getCreditStatus } from "@/lib/credits";
import { toast } from "@/components/ui/use-toast";

export default function Lessons() {
  const [credits, setCredits] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dailyGoal, setDailyGoal] = useState(1);
  const [dailyCompleted, setDailyCompleted] = useState(0);

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
    try {
      const savedGoal = Number(localStorage.getItem("vardin_lesson_daily_goal"));
      const savedDate = localStorage.getItem("vardin_lesson_goal_date");
      const today = new Date().toISOString().slice(0, 10);
      if (savedGoal >= 1 && savedGoal <= 5) setDailyGoal(savedGoal);
      if (savedDate === today) setDailyCompleted(Number(localStorage.getItem("vardin_lesson_goal_completed") || 0));
      else {
        localStorage.setItem("vardin_lesson_goal_date", today);
        localStorage.setItem("vardin_lesson_goal_completed", "0");
      }
    } catch {}
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
  const completedIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const firstIncomplete = allLessons.find((l) => !completedIds.has(l.id));
  const filteredCategories = selectedCategory === "all"
    ? LESSON_CATEGORIES
    : LESSON_CATEGORIES.filter((c) => c.id === selectedCategory);

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

      try {
        const today = new Date().toISOString().slice(0, 10);
        const nextDaily = dailyCompleted + 1;
        localStorage.setItem("vardin_lesson_goal_date", today);
        localStorage.setItem("vardin_lesson_goal_completed", String(nextDaily));
        setDailyCompleted(nextDaily);
      } catch {}

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

      {/* Gamified progress dashboard */}
      <div className="space-y-3 animate-slide-up anim-delay-1">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-card rounded-2xl border border-border/50 p-3 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-warning"><Flame className="w-4 h-4" /><span className="text-lg font-bold">{dailyCompleted}</span></div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Today</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-3 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-primary"><Star className="w-4 h-4" /><span className="text-lg font-bold">{totalXP}</span></div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">XP earned</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-3 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-success"><Check className="w-4 h-4" /><span className="text-lg font-bold">{completedCount}</span></div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Lessons done</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0"><Target className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-semibold text-sm">Daily goal</span></div>
            <span className="text-xs font-semibold text-primary whitespace-nowrap">{Math.min(dailyCompleted, dailyGoal)}/{dailyGoal} lessons</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (dailyCompleted / dailyGoal) * 100)}%` }} /></div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <p className="text-xs text-muted-foreground">{dailyCompleted >= dailyGoal ? "Goal complete — great work!" : "One small lesson keeps your streak moving."}</p>
            <select aria-label="Daily lesson goal" value={dailyGoal} onChange={(e) => { const v=Number(e.target.value); setDailyGoal(v); try { localStorage.setItem("vardin_lesson_daily_goal", String(v)); } catch {} }} className="text-xs bg-transparent border-0 text-muted-foreground focus:ring-0 cursor-pointer">
              {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}/day</option>)}
            </select>
          </div>
        </div>
      </div>

      {firstIncomplete && (
        <button onClick={() => handleStartLesson(firstIncomplete, firstIncomplete.category)} className="w-full text-left rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 animate-slide-up anim-delay-1">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0"><Play className="w-6 h-6 fill-current" /></div>
            <div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-wider font-semibold text-white/75">Continue your path</p><h3 className="font-bold text-base sm:text-lg truncate mt-0.5">{firstIncomplete.title}</h3><p className="text-xs text-white/80 mt-0.5">{firstIncomplete.xp} XP · {firstIncomplete.category.name}</p></div>
            <ChevronRight className="w-5 h-5 flex-shrink-0 text-white/80" />
          </div>
        </button>
      )}

      <div className="animate-slide-up anim-delay-1">
        <LessonStats progress={progress} totalLessons={allLessons.length} xp={totalXP} streak={1} />
      </div>

      {/* Call Simulator Banner */}
      <Link
        to="/call-simulator"
        className="block bg-gradient-to-r from-rose-500 to-red-600 rounded-2xl p-5 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 transition-all animate-slide-up anim-delay-1"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm sm:text-base">Practice Call Simulator</h3>
            <p className="text-xs text-white/80 mt-0.5">Roleplay against an AI scammer and get scored on your performance</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
        </div>
      </Link>

      {/* Spot the Scam Banner */}
      <Link
        to="/spot-the-scam"
        className="block bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all animate-slide-up anim-delay-1"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Scan className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm sm:text-base">Spot the Scam Game</h3>
            <p className="text-xs text-white/80 mt-0.5">Test your scam detection skills — 10 rounds, can you get a perfect score?</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
        </div>
      </Link>

      {completedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card rounded-xl border border-border/50 p-3 animate-fade-in">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <span>You've completed {completedCount} of {allLessons.length} lessons. Keep it up!</span>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-8">
        <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex gap-2 min-w-max px-1">
            <button onClick={() => setSelectedCategory("all")} className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${selectedCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60 text-muted-foreground"}`}>All units</button>
            {LESSON_CATEGORIES.map((category) => {
              const done = category.lessons.filter(l => completedIds.has(l.id)).length;
              return <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${selectedCategory === category.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60 text-muted-foreground"}`}>{category.name} <span className="opacity-70">{done}/{category.lessons.length}</span></button>;
            })}
          </div>
        </div>

        {filteredCategories.map((category, catIdx) => (
          <div key={category.id} className="space-y-3 animate-slide-up" style={{ animationDelay: `${(catIdx + 2) * 80}ms` }}>
            <div className="flex items-center gap-3">
              {category.logo && (
                <img
                  src={category.logo}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
                />
              )}
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