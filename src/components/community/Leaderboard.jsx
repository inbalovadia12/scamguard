import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Loader2 } from "lucide-react";

const RANK_STYLES = [
  { color: "from-amber-400 to-amber-600", text: "text-amber-600 dark:text-amber-400", icon: "🥇" },
  { color: "from-slate-300 to-slate-500", text: "text-slate-500 dark:text-slate-300", icon: "🥈" },
  { color: "from-orange-400 to-orange-700", text: "text-orange-600 dark:text-orange-400", icon: "🥉" },
];

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stories = await base44.entities.CommunityStory.filter(
          { status: "active" },
          "-created_date",
          100
        );
        const authorMap = {};
        for (const s of stories) {
          const name = s.anonymous ? "Anonymous" : s.author_name || "Community Member";
          if (!authorMap[name]) authorMap[name] = { name, likes: 0, stories: 0 };
          authorMap[name].likes += s.likes_count || 0;
          authorMap[name].stories += 1;
        }
        const sorted = Object.values(authorMap)
          .sort((a, b) => b.likes - a.likes)
          .slice(0, 5);
        setTopUsers(sorted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (topUsers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 animate-slide-up anim-delay-2">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm font-heading">Top Contributors</h2>
      </div>

      <div className="space-y-2">
        {topUsers.map((user, i) => {
          const rank = RANK_STYLES[i] || { color: "from-muted to-muted", text: "text-muted-foreground", icon: `${i + 1}` };
          return (
            <div
              key={user.name}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                i < 3 ? "bg-gradient-to-r from-primary/5 to-transparent border border-primary/10" : "bg-muted/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${rank.color} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>
                {rank.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.stories} {user.stories === 1 ? "story" : "stories"}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold tabular-nums ${rank.text}`}>{user.likes}</p>
                <p className="text-[10px] text-muted-foreground">likes</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Share your story and get likes to climb the leaderboard!
      </p>
    </div>
  );
}