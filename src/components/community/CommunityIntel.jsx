import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, ChevronRight, Loader2, Heart } from "lucide-react";
import { useCommunityData } from "@/hooks/useCommunityData";
import { formatDistanceToNow } from "date-fns";

// Maps free-text scam categories (from AI) to CommunityStory enum values
const CATEGORY_KEYWORD_MAP = {
  phishing: "phishing_email",
  email: "phishing_email",
  sms: "smishing",
  text: "smishing",
  romance: "romance",
  dating: "romance",
  crypto: "crypto_investment",
  investment: "crypto_investment",
  marketplace: "marketplace",
  "tech support": "tech_support",
  job: "fake_job",
  delivery: "delivery",
  package: "delivery",
  lottery: "lottery_prize",
  prize: "lottery_prize",
  government: "government_impersonation",
  irs: "government_impersonation",
  tax: "government_impersonation",
  bank: "bank_impersonation",
};

export function matchCategoriesToEnum(categories = []) {
  const matches = [];
  for (const cat of categories) {
    const lower = (cat || "").toLowerCase();
    for (const [keyword, enumVal] of Object.entries(CATEGORY_KEYWORD_MAP)) {
      if (lower.includes(keyword) && !matches.includes(enumVal)) {
        matches.push(enumVal);
      }
    }
  }
  return matches;
}

export default function CommunityIntel({ scamTypes = [], country, title = "Community Intel", maxStories = 2 }) {
  const { enabled } = useCommunityData();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const fetchStories = async () => {
      setLoading(true);
      try {
        const data = await base44.entities.CommunityStory.filter(
          { status: "active" },
          "-created_date",
          20
        );
        let filtered = scamTypes.length
          ? data.filter((s) => scamTypes.includes(s.scam_type))
          : data;
        if (country) {
          const countryMatches = data.filter(
            (s) => s.country && s.country.toLowerCase().includes(country.toLowerCase())
          );
          filtered = [...filtered, ...countryMatches.filter((m) => !filtered.includes(m))];
        }
        setStories(filtered.slice(0, maxStories));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [enabled, JSON.stringify(scamTypes), country, maxStories]);

  if (!enabled) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Users className="w-3.5 h-3.5 text-primary" />
          {title}
        </div>
        <Link to="/community" className="text-xs text-primary hover:underline flex items-center gap-0.5">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Loading community stories...</span>
        </div>
      ) : stories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            No community stories match this scam type yet.
          </p>
          <Link to="/community" className="text-xs text-primary hover:underline">
            Share your experience →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {stories.map((story) => (
            <Link
              key={story.id}
              to="/community"
              className="block rounded-xl border border-border/50 bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-primary-foreground text-[10px] font-bold flex-shrink-0">
                  {(story.anonymous ? "A" : (story.author_name || "C")).charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium truncate">
                  {story.anonymous ? "Anonymous" : story.author_name || "Community Member"}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(story.created_date), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug line-clamp-1 mb-0.5">{story.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{story.story}</p>
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                <Heart className="w-3 h-3" />
                {story.likes_count || 0} likes
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}