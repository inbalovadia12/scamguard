import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Users, PenSquare, Filter, Globe, TrendingUp } from "lucide-react";
import StoryCard from "@/components/community/StoryCard";
import ShareStoryDialog from "@/components/community/ShareStoryDialog";
import Leaderboard from "@/components/community/Leaderboard";

const FILTER_OPTIONS = [
  { value: "", label: "All Stories" },
  { value: "phishing_email", label: "Phishing" },
  { value: "smishing", label: "SMS" },
  { value: "romance", label: "Romance" },
  { value: "crypto_investment", label: "Crypto" },
  { value: "marketplace", label: "Marketplace" },
  { value: "tech_support", label: "Tech Support" },
  { value: "fake_job", label: "Fake Jobs" },
  { value: "delivery", label: "Delivery" },
  { value: "other", label: "Other" },
];

export default function Community() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [likedIds, setLikedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vardin_liked_stories") || "[]"); } catch { return []; }
  });

  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const query = { status: "active" };
      if (filter) query.scam_type = filter;
      const data = await base44.entities.CommunityStory.filter(query, "-created_date", 50);
      setStories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const toggleLiked = (id) => {
    const updated = likedIds.includes(id) ? likedIds.filter((x) => x !== id) : [...likedIds, id];
    setLikedIds(updated);
    localStorage.setItem("vardin_liked_stories", JSON.stringify(updated));
  };

  const handleLike = async (id) => {
    const isLiked = likedIds.includes(id);
    const story = stories.find((s) => s.id === id);
    if (!story) return;

    // Optimistic update
    setStories((prev) => prev.map((s) => s.id === id ? { ...s, likes_count: Math.max(0, (s.likes_count || 0) + (isLiked ? -1 : 1)) } : s));
    toggleLiked(id);

    try {
      await base44.functions.invoke("toggleStoryLike", {
        story_id: id,
        action: isLiked ? "unlike" : "like",
      });
    } catch (e) {
      // Revert on error
      setStories((prev) => prev.map((s) => s.id === id ? { ...s, likes_count: story.likes_count } : s));
      toggleLiked(id);
    }
  };

  const totalStories = stories.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Community</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg">
          Real scam experiences shared by the community. Every story helps our AI learn about new tactics and protects others.
        </p>
      </div>

      {/* AI learning banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-cyan-500/5 border border-primary/15 animate-slide-up anim-delay-1">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Community-Powered AI Protection</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Shared stories are added to our scam database as real-world data. The AI uses these patterns to detect emerging scams and protect everyone using Vardin.
          </p>
        </div>
      </div>

      {/* Leaderboard */}
      <Leaderboard />

      {/* Share button + filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between animate-slide-up anim-delay-1">
        <Button onClick={() => setShareOpen(true)} className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20">
          <PenSquare className="w-4 h-4" />
          Share Your Experience
        </Button>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stories feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
            <Globe className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {filter ? "No stories for this scam type yet." : "No stories yet. Be the first to share!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up anim-delay-2">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              liked={likedIds.includes(story.id)}
              onLike={handleLike}
            />
          ))}
        </div>
      )}

      <ShareStoryDialog open={shareOpen} onOpenChange={setShareOpen} onSubmitted={loadStories} />
    </div>
  );
}