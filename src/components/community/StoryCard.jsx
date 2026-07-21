import React from "react";
import { Heart, MessageCircle, MapPin, Clock, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

const SCAM_TYPE_LABELS = {
  phishing_email: "Phishing Email",
  smishing: "SMS Scam",
  romance: "Romance Scam",
  crypto_investment: "Crypto Scam",
  marketplace: "Marketplace Scam",
  tech_support: "Tech Support Scam",
  fake_job: "Fake Job",
  delivery: "Delivery Scam",
  lottery_prize: "Lottery / Prize",
  government_impersonation: "Gov Impersonation",
  bank_impersonation: "Bank Impersonation",
  other: "Other",
};

const SCAM_TYPE_COLORS = {
  phishing_email: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  smishing: "bg-green-500/10 text-green-600 dark:text-green-400",
  romance: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  crypto_investment: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  marketplace: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  tech_support: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  fake_job: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  delivery: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  lottery_prize: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  government_impersonation: "bg-red-500/10 text-red-600 dark:text-red-400",
  bank_impersonation: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  other: "bg-muted text-muted-foreground",
};

export default function StoryCard({ story, onLike, liked }) {
  const typeLabel = SCAM_TYPE_LABELS[story.scam_type] || "Other";
  const typeColor = SCAM_TYPE_COLORS[story.scam_type] || SCAM_TYPE_COLORS.other;
  const authorDisplay = story.anonymous ? "Anonymous" : (story.author_name || "Community Member");

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden luxury-card-hover">
      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
              {authorDisplay.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{authorDisplay}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(story.created_date), { addSuffix: true })}
                {story.country && (
                  <>
                    <span>·</span>
                    <MapPin className="w-3 h-3" />
                    {story.country}
                  </>
                )}
              </div>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${typeColor}`}>
            {typeLabel}
          </span>
        </div>

        {/* Title & story */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-base leading-snug">{story.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">{story.story}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike(story.id)}
            className={`gap-1.5 ${liked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            <span className="text-sm font-medium">{story.likes_count || 0}</span>
          </Button>
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-success/60" />
            <span>Verified experience</span>
          </div>
        </div>
      </div>
    </div>
  );
}