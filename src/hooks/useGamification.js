import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export const LEVELS = [
  { name: "Scout", minXp: 0, icon: "🛡️" },
  { name: "Analyst", minXp: 100, icon: "🔍" },
  { name: "Guardian", minXp: 300, icon: "⚔️" },
  { name: "Sentinel", minXp: 600, icon: "🏆" },
  { name: "Guardian Elite", minXp: 1000, icon: "👑" },
];

export const XP_REWARDS = {
  scan: 10,
  lesson: 50,
  story: 30,
};

export const BADGES = [
  { id: "first_catch", name: "First Catch", desc: "Run your first scan", icon: "🎯", condition: (s) => s.scans >= 1 },
  { id: "week_warrior", name: "Week Warrior", desc: "7-day scan streak", icon: "🔥", condition: (s) => s.streak >= 7 },
  { id: "scam_slayer", name: "Scam Slayer", desc: "30-day scan streak", icon: "⚔️", condition: (s) => s.streak >= 30 },
  { id: "story_teller", name: "Story Teller", desc: "Share a community story", icon: "📖", condition: (s) => s.stories >= 1 },
  { id: "lesson_master", name: "Lesson Master", desc: "Complete 5 lessons", icon: "🎓", condition: (s) => s.lessons >= 5 },
  { id: "guardian", name: "Guardian", desc: "Reach Guardian level", icon: "🛡️", condition: (s) => s.xp >= 300 },
  { id: "sentinel", name: "Sentinel", desc: "Reach Sentinel level", icon: "🏆", condition: (s) => s.xp >= 600 },
  { id: "centurion", name: "Centurion", desc: "100 total scans", icon: "💯", condition: (s) => s.scans >= 100 },
];

function getStreakFromDates(dates) {
  const daySet = new Set();
  for (const d of dates) {
    if (d) daySet.add(new Date(d).toDateString());
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (!daySet.has(today.toDateString())) {
    if (!daySet.has(yesterday.toDateString())) return 0;
  }

  let streak = 0;
  let checkDate = new Date(today);
  if (!daySet.has(checkDate.toDateString())) {
    checkDate = new Date(yesterday);
  }

  while (daySet.has(checkDate.toDateString())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export function useGamification() {
  const [stats, setStats] = useState({
    scans: 0, lessons: 0, stories: 0, xp: 0, streak: 0,
    level: LEVELS[0], loading: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const user = await base44.auth.me();
        const [analyses, lessons, stories] = await Promise.all([
          base44.entities.ScamAnalysis.filter({ created_by_id: user.id }, "-created_date", 100),
          base44.entities.LessonProgress.filter({ created_by_id: user.id, status: "completed" }, "-created_date", 50),
          base44.entities.CommunityStory.filter({ created_by_id: user.id, status: "active" }, "-created_date", 50),
        ]);

        const scans = analyses.length;
        const lessonsCount = lessons.length;
        const storiesCount = stories.length;
        const xp = scans * XP_REWARDS.scan + lessonsCount * XP_REWARDS.lesson + storiesCount * XP_REWARDS.story;
        const streak = getStreakFromDates(analyses.map((a) => a.created_date));

        let level = LEVELS[0];
        for (const l of LEVELS) {
          if (xp >= l.minXp) level = l;
        }

        setStats({ scans, lessons: lessonsCount, stories: storiesCount, xp, streak, level, loading: false });
      } catch (e) {
        setStats((s) => ({ ...s, loading: false }));
      }
    };
    load();
  }, []);

  const nextLevel = LEVELS.find((l) => l.minXp > stats.xp);
  const progressToNext = nextLevel
    ? Math.round(((stats.xp - stats.level.minXp) / (nextLevel.minXp - stats.level.minXp)) * 100)
    : 100;
  const earnedBadges = BADGES.filter((b) => b.condition(stats));

  return { ...stats, nextLevel, progressToNext, earnedBadges };
}