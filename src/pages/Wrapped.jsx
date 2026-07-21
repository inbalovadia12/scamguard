import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Sparkles, Scan, Shield, Calendar, Zap, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import StoryViewer from "@/components/wrapped/StoryViewer";
import {
  IntroSlide, TotalScansSlide, ScamsBlockedSlide, TopThreatSlide,
  RiskBreakdownSlide, DaysActiveSlide, CreditsSlide, OutroSlide
} from "@/components/wrapped/WrappedSlides";

export default function Wrapped() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    base44.functions.invoke("getYearlyWrapped", {})
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (viewing && stats) {
    const slides = [
      { component: () => <IntroSlide stats={stats} />, duration: 5000 },
      { component: () => <TotalScansSlide stats={stats} />, duration: 5000 },
      { component: () => <ScamsBlockedSlide stats={stats} />, duration: 5000 },
      stats.top_scam_type ? { component: () => <TopThreatSlide stats={stats} />, duration: 5000 } : null,
      { component: () => <RiskBreakdownSlide stats={stats} />, duration: 6000 },
      { component: () => <DaysActiveSlide stats={stats} />, duration: 5000 },
      { component: () => <CreditsSlide stats={stats} />, duration: 5000 },
      { component: () => <OutroSlide stats={stats} onShare={() => {
        if (navigator.share) {
          navigator.share({ title: "My Vardin Wrapped", text: `I was protected from ${stats.scams_blocked} scams this year with Vardin!`, url: window.location.origin });
        }
      }} />, duration: 10000 },
    ].filter(Boolean);

    return (
      <StoryViewer
        slides={slides}
        index={slideIndex}
        setIndex={setSlideIndex}
        onClose={() => setViewing(false)}
      />
    );
  }

  // Empty state
  if (!stats || stats.total_scans === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 py-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Your Vardin Wrapped</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            You haven't run any scans yet. Start protecting yourself from scams to unlock your personalized yearly recap.
          </p>
        </div>
        <Link to="/check">
          <Button className="gap-2 bg-gradient-to-r from-violet-500 via-primary to-cyan-500">
            <Scan className="w-4 h-4" />
            Run Your First Scan
          </Button>
        </Link>
      </div>
    );
  }

  // Landing
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-3 animate-slide-up">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Your 2026 Vardin Wrapped</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {stats.user_name}, your year in scam protection is ready. Tap to view your story.
        </p>
      </div>

      {/* Preview cards */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up anim-delay-1">
        <PreviewCard icon={Scan} value={stats.total_scans} label="Total Scans" gradient="from-emerald-500 to-teal-600" />
        <PreviewCard icon={Shield} value={stats.scams_blocked} label="Scams Blocked" gradient="from-red-500 to-orange-500" />
        <PreviewCard icon={Calendar} value={stats.days_active} label="Days Active" gradient="from-amber-500 to-orange-500" />
        <PreviewCard icon={Zap} value={stats.credits_used} label="Credits Used" gradient="from-cyan-500 to-blue-600" />
      </div>

      {/* Play button */}
      <div className="text-center animate-slide-up anim-delay-2">
        <Button
          onClick={() => { setSlideIndex(0); setViewing(true); }}
          className="gap-2 bg-gradient-to-r from-violet-500 via-primary to-cyan-500 shadow-lg shadow-primary/30 h-12 sm:h-14 text-base sm:text-lg font-semibold rounded-xl px-8"
          size="lg"
        >
          <Play className="w-5 h-5" />
          Play My Wrapped
        </Button>
        <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
          <ChevronRight className="w-3 h-3" />
          Tap, swipe, or use arrow keys to navigate
        </p>
      </div>
    </div>
  );
}

function PreviewCard({ icon: Icon, value, label, gradient }) {
  return (
    <div className={`relative rounded-2xl p-4 bg-gradient-to-br ${gradient} overflow-hidden`}>
      <Icon className="w-5 h-5 text-white/80 mb-2" />
      <p className="text-white text-2xl sm:text-3xl font-bold font-heading">{value}</p>
      <p className="text-white/80 text-xs sm:text-sm">{label}</p>
    </div>
  );
}