import React, { useState } from "react";
import { Shield, Scan, AlertTriangle, TrendingUp, Calendar, Zap, Trophy, Share2, Sparkles, Check } from "lucide-react";

const BG_IMAGES = {
  intro: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/796fcaa9e_generated_image.png",
  shield: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/3549164c8_generated_image.png",
  outro: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/abb8c67dc_generated_image.png",
};

const SCAM_TYPE_LABELS = {
  sms: "SMS / Text",
  email: "Email",
  job_offer: "Job Offer",
  marketplace: "Marketplace",
  romance: "Romance / Dating",
  bank_government: "Bank / Government",
  tech_support: "Tech Support",
  crypto_investment: "Crypto / Investment",
  delivery: "Package Delivery",
  lottery_prize: "Lottery / Prize",
  charity: "Charity",
  url: "URL / Link",
  other: "Other",
};

function SlideShell({ gradient, imageUrl, children }) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} px-6 text-center overflow-hidden`}>
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function IntroSlide({ stats }) {
  return (
    <SlideShell gradient="from-violet-600 via-primary to-cyan-500" imageUrl={BG_IMAGES.intro}>
      <Sparkles className="w-12 h-12 text-white/80 mb-4 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg font-medium mb-2 animate-fade-in">Vardin presents</p>
      <h1 className="text-white text-4xl sm:text-7xl font-bold font-heading mb-4 animate-slide-up leading-tight">
        Your 2026<br />Wrapped
      </h1>
      <p className="text-white/90 text-base sm:text-xl animate-slide-up anim-delay-1">
        {stats.user_name}, let's look at your year in scam protection
      </p>
    </SlideShell>
  );
}

export function TotalScansSlide({ stats }) {
  return (
    <SlideShell gradient="from-emerald-500 via-teal-500 to-cyan-600">
      <Scan className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-6 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-2">You ran</p>
      <h1 className="text-white text-7xl sm:text-8xl font-bold font-heading mb-2 animate-scale-in">
        {stats.total_scans}
      </h1>
      <p className="text-white/90 text-lg sm:text-2xl">scans this year</p>
    </SlideShell>
  );
}

export function ScamsBlockedSlide({ stats }) {
  return (
    <SlideShell gradient="from-red-500 via-orange-500 to-amber-500" imageUrl={BG_IMAGES.shield}>
      <Shield className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-6 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-2">We protected you from</p>
      <h1 className="text-white text-7xl sm:text-8xl font-bold font-heading mb-2 animate-scale-in">
        {stats.scams_blocked}
      </h1>
      <p className="text-white/90 text-lg sm:text-2xl">potential scams</p>
    </SlideShell>
  );
}

export function TopThreatSlide({ stats }) {
  const label = SCAM_TYPE_LABELS[stats.top_scam_type] || "Various Scams";
  return (
    <SlideShell gradient="from-purple-600 via-pink-500 to-rose-500">
      <AlertTriangle className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-6 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-2">Your biggest threat was</p>
      <h1 className="text-white text-3xl sm:text-6xl font-bold font-heading mb-2 animate-slide-up leading-tight">
        {label}
      </h1>
      <p className="text-white/90 text-base sm:text-lg mt-4">{stats.top_scam_type_count} encounter{stats.top_scam_type_count !== 1 ? "s" : ""} detected</p>
    </SlideShell>
  );
}

export function RiskBreakdownSlide({ stats }) {
  const total = stats.risk_breakdown.high + stats.risk_breakdown.medium + stats.risk_breakdown.low || 1;
  const items = [
    { label: "High Risk", count: stats.risk_breakdown.high, color: "bg-red-400" },
    { label: "Medium Risk", count: stats.risk_breakdown.medium, color: "bg-amber-400" },
    { label: "Low Risk", count: stats.risk_breakdown.low, color: "bg-emerald-400" },
  ];
  return (
    <SlideShell gradient="from-blue-600 via-indigo-600 to-violet-700">
      <TrendingUp className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-4 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-6">Your risk breakdown</p>
      <div className="space-y-4 w-full max-w-sm">
        {items.map((item, i) => (
          <div key={item.label} className="animate-slide-up" style={{ animationDelay: `${i * 0.15}s` }}>
            <div className="flex justify-between text-white text-sm mb-1.5">
              <span className="font-medium">{item.label}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                style={{ width: `${(item.count / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

export function DaysActiveSlide({ stats }) {
  return (
    <SlideShell gradient="from-amber-500 via-orange-500 to-red-500">
      <Calendar className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-6 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-2">You stayed protected for</p>
      <h1 className="text-white text-7xl sm:text-8xl font-bold font-heading mb-2 animate-scale-in">
        {stats.days_active}
      </h1>
      <p className="text-white/90 text-lg sm:text-2xl">day{stats.days_active !== 1 ? "s" : ""} this year</p>
    </SlideShell>
  );
}

export function CreditsSlide({ stats }) {
  return (
    <SlideShell gradient="from-cyan-500 via-blue-500 to-indigo-600">
      <Zap className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-6 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-2">You used</p>
      <h1 className="text-white text-7xl sm:text-8xl font-bold font-heading mb-2 animate-scale-in">
        {stats.credits_used}
      </h1>
      <p className="text-white/90 text-lg sm:text-2xl">AI credits staying safe</p>
    </SlideShell>
  );
}

export function OutroSlide({ stats, onShare }) {
  const [shared, setShared] = useState(false);
  const percentile = Math.min(99, Math.max(50, 50 + stats.total_scans * 2));

  const handleShare = async () => {
    await onShare();
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };

  return (
    <SlideShell gradient="from-violet-600 via-primary to-cyan-500" imageUrl={BG_IMAGES.outro}>
      <Trophy className="w-14 h-14 sm:w-16 sm:h-16 text-white/90 mb-6 animate-bounce-in" />
      <p className="text-white/70 text-base sm:text-lg mb-2">You're safer than</p>
      <h1 className="text-white text-6xl sm:text-7xl font-bold font-heading mb-2 animate-scale-in">
        {percentile}%
      </h1>
      <p className="text-white/90 text-lg sm:text-2xl mb-8">of users this year</p>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-6 py-3 bg-white text-primary rounded-full font-semibold text-base sm:text-lg hover:scale-105 transition-transform animate-slide-up shadow-lg"
      >
        {shared ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
        {shared ? "Copied!" : "Share Your Wrapped"}
      </button>
      <p className="text-white/60 text-xs sm:text-sm mt-6">Thank you for protecting yourself with Vardin</p>
    </SlideShell>
  );
}