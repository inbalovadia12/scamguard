import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, KeyRound, Heart } from "lucide-react";

const ARTICLES = [
  {
    emoji: "💎",
    title: "Free Robux & V-Bucks",
    color: "from-green-500 to-emerald-500",
    content: "Nobody gives away free Robux or V-Bucks for real. If someone says you can get free game money by clicking a link or entering your password, it's a scam! These bad websites steal your account. Only buy Robux from the official Roblox app or website. Never trust 'free Robux generators' — they don't exist!",
  },
  {
    emoji: "🎮",
    title: "Gaming Scams",
    color: "from-violet-500 to-purple-500",
    content: "Scammers love gamers! They might offer free skins, rare accounts, or say they'll level you up. They'll ask for your password or want you to click a link. Real game companies never ask for your password. If someone offers something that seems too good to be true in a game, it's probably a scam!",
  },
  {
    emoji: "🎁",
    title: "Fake Giveaways",
    color: "from-pink-500 to-rose-500",
    content: "If you get a message saying 'You won!' but you never entered a contest, it's fake! Scammers send fake prize notifications to get you to click bad links or pay 'shipping fees.' Real giveaways don't ask for money or your password. If you didn't enter, you didn't win!",
  },
  {
    emoji: "⭐",
    title: "Fake Influencers",
    color: "from-amber-500 to-orange-500",
    content: "Scammers make fake accounts pretending to be famous YouTubers, TikTokers, and streamers. They send messages saying you won a giveaway or they want to be your friend. Real famous people don't message fans asking for money or passwords. Look for the verified checkmark and be suspicious of new accounts claiming to be celebrities!",
  },
  {
    emoji: "👤",
    title: "Fake Friends",
    color: "from-blue-500 to-cyan-500",
    content: "Scammers pretend to be your friends or family! They might make a new account that looks just like your friend's, then ask for money or your password. If someone you know gets a 'new number' and asks for money, check with them in person or on a video call first. Real friends will understand you being careful!",
  },
  {
    emoji: "⬇️",
    title: "Dangerous Downloads",
    color: "from-red-500 to-rose-600",
    content: "Never download files from strangers or click links to 'free games' or 'cheats.' These can contain viruses that steal your passwords or take over your computer! Only download apps from official stores like the App Store, Google Play, or the official game website. If a download seems sketchy, it probably is!",
  },
  {
    emoji: "💬",
    title: "Discord & Social Media Safety",
    color: "from-indigo-500 to-blue-500",
    content: "On Discord, Instagram, TikTok, and other apps, be careful with messages from strangers. Never click links from people you don't know. Turn off DMs from strangers in your settings. If someone you don't know sends you a 'gift link' or asks you to join a server, tell a parent. Keep your profiles private!",
  },
];

function ArticleCard({ article }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${article.color} flex items-center justify-center text-2xl flex-shrink-0`}>
          {article.emoji}
        </div>
        <h3 className="font-bold text-sm sm:text-base flex-1">{article.title}</h3>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 animate-fade-in">
          <p className="text-sm leading-relaxed text-muted-foreground">{article.content}</p>
        </div>
      )}
    </div>
  );
}

export default function KidLibrary() {
  return (
    <div className="space-y-5 pb-6">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">📚 Scam Library</h1>
        <p className="text-muted-foreground mt-1">Learn about common scams so you can spot them!</p>
      </div>

      {/* Password & Verification Code Warning */}
      <div className="rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border-2 border-red-500/30 p-5 space-y-3 animate-slide-up" style={{ animationDelay: "30ms" }}>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-red-500">Never Share Passwords or Codes!</h2>
        </div>
        <div className="space-y-2 text-sm leading-relaxed">
          <p>🔒 Your password is like a house key. <strong>Nobody</strong> should ever ask for it — not friends, not game admins, not customer support, not even us!</p>
          <p>🔢 If you get a 6-digit code on your phone for login, <strong>never</strong> tell it to anyone. Scammers ask for these codes to break into accounts!</p>
          <p>✅ Real companies will never ask for your password or login code. If someone does, it's a scam — tell a parent right away!</p>
        </div>
        <div className="flex items-center gap-2 pt-1 text-sm font-medium text-pink-500">
          <Heart className="w-4 h-4" /> When in doubt, Ask a Parent!
        </div>
      </div>

      {/* Articles */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
        {ARTICLES.map((article) => (
          <ArticleCard key={article.title} article={article} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
        <BookOpen className="w-4 h-4" />
        <span>Tap any card to learn more</span>
      </div>
    </div>
  );
}