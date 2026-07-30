import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Gamepad2, Gift, Star, UserCircle, Download, MessageCircle, Diamond,
  Loader2, ShieldCheck, AlertTriangle, ShieldAlert, RotateCcw, Heart, Send,
  MessageSquare, Globe, Image as ImageIcon, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import AIDisclaimer from "@/components/AIDisclaimer";

const CATEGORIES = [
  { id: "gaming", icon: Gamepad2, emoji: "🎮", title: "Gaming Scams", color: "from-violet-500 to-purple-500", desc: "Free skins, accounts, or game stuff" },
  { id: "robux", icon: Diamond, emoji: "💎", title: "Free Robux / V-Bucks", color: "from-green-500 to-emerald-500", desc: "Promises of free game money" },
  { id: "giveaway", icon: Gift, emoji: "🎁", title: "Fake Giveaways", color: "from-pink-500 to-rose-500", desc: "You won! Click here..." },
  { id: "influencer", icon: Star, emoji: "⭐", title: "Fake Influencer", color: "from-amber-500 to-orange-500", desc: "Pretending to be famous" },
  { id: "impersonation", icon: UserCircle, emoji: "👤", title: "Fake Friend", color: "from-blue-500 to-cyan-500", desc: "Pretending to be someone you know" },
  { id: "downloads", icon: Download, emoji: "⬇️", title: "Dangerous Downloads", color: "from-red-500 to-rose-600", desc: "Sketchy links and files" },
  { id: "social", icon: MessageCircle, emoji: "💬", title: "Discord & Social", color: "from-indigo-500 to-blue-500", desc: "Messages from social apps" },
];

const CATEGORY_DESC = {
  gaming: "something related to free game items, skins, accounts, or in-game currency",
  robux: "someone promising free Robux, V-Bucks, or other game currency",
  giveaway: "a giveaway, prize, or contest notification",
  influencer: "someone claiming to be a famous YouTuber, TikToker, streamer, or celebrity",
  impersonation: "someone pretending to be a friend, family member, or someone the kid knows",
  downloads: "a download link, file, or app someone shared",
  social: "a message received on Discord, Instagram, TikTok, Snapchat, or other social media",
};

const INPUT_TYPES = [
  { id: "message", icon: MessageSquare, label: "Paste Message" },
  { id: "link", icon: Globe, label: "Enter Link" },
  { id: "screenshot", icon: ImageIcon, label: "Screenshot" },
];

const RISK_DISPLAY = {
  low: { emoji: "✅", color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck },
  medium: { emoji: "⚠️", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle },
  high: { emoji: "🛑", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert },
};

export default function KidScanner() {
  const [category, setCategory] = useState(null);
  const [inputType, setInputType] = useState("message");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image must be under 10MB."); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const buildPrompt = (contentDesc) =>
    `You are Vardin Kid Guard, a friendly AI that helps kids stay safe online. A kid is checking something they saw and wants to know if it's safe.

What the kid is checking: ${CATEGORY_DESC[category]}
The thing they saw: ${contentDesc}

Analyze this for scam risk. Use simple, friendly language that a 10-year-old can understand. Be encouraging, not scary.

Provide:
- risk_level: "low", "medium", or "high"
- is_safe: true if this is safe, false if it's dangerous
- title: a short friendly title (like "This looks safe!" or "Watch out!" or "This is a scam!")
- explanation: simple kid-friendly explanation of why this is safe or dangerous (2-3 sentences)
- what_to_do: simple steps the kid should take (array of strings, kid-friendly)
- tell_parent: true if the kid should tell a parent about this, false if it's totally safe`;

  const SCHEMA = {
    type: "object",
    properties: {
      risk_level: { type: "string", enum: ["low", "medium", "high"] },
      is_safe: { type: "boolean" },
      title: { type: "string" },
      explanation: { type: "string" },
      what_to_do: { type: "array", items: { type: "string" } },
      tell_parent: { type: "boolean" },
    },
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      let res;
      if (inputType === "message") {
        res = await base44.integrations.Core.InvokeLLM({
          prompt: buildPrompt(`"""${text.trim().slice(0, 3000)}"""`),
          response_json_schema: SCHEMA,
        });
      } else if (inputType === "link") {
        res = await base44.integrations.Core.InvokeLLM({
          prompt: buildPrompt(`A link/website: ${url.trim()}`),
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: SCHEMA,
        });
      } else if (inputType === "screenshot") {
        let image_url = null;
        if (selectedFile) {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
          image_url = uploadRes.file_url;
        }
        res = await base44.integrations.Core.InvokeLLM({
          prompt: buildPrompt("A screenshot/image of what they saw (analyze the image)"),
          add_context_from_internet: true,
          model: "gemini_3_flash",
          file_urls: [image_url],
          response_json_schema: SCHEMA,
        });
      }
      setResult(res);
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    }
    setScanning(false);
  };

  const canScan = () => {
    if (scanning) return false;
    if (inputType === "message") return text.trim().length > 10;
    if (inputType === "link") return url.trim().length > 3;
    if (inputType === "screenshot") return !!selectedFile;
    return false;
  };

  const reset = () => {
    setCategory(null);
    setInputType("message");
    setText("");
    setUrl("");
    clearImage();
    setResult(null);
    setError(null);
  };

  if (!category) {
    return (
      <div className="space-y-5">
        <div className="animate-slide-up">
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">🎮 Scam Scanner</h1>
          <p className="text-muted-foreground mt-1">Pick what you want to check. I'll help you know if it's safe!</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="group text-left p-4 sm:p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-primary/30 transition-all hover:-translate-y-0.5"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl mb-3 shadow-md`}>
                {cat.emoji}
              </div>
              <h3 className="font-bold text-sm sm:text-base">{cat.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
            </button>
          ))}
        </div>
        <AIDisclaimer />
      </div>
    );
  }

  const selectedCat = CATEGORIES.find((c) => c.id === category);
  const risk = result ? RISK_DISPLAY[result.risk_level] : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 animate-slide-up">
        <button onClick={reset} className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{selectedCat.emoji}</span>
          <h1 className="text-xl font-bold font-heading">{selectedCat.title}</h1>
        </div>
      </div>

      {!result && !scanning && (
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
          {/* Input Type Selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">How do you want to show it?</p>
            <div className="grid grid-cols-3 gap-2">
              {INPUT_TYPES.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setInputType(it.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    inputType === it.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/50 bg-card text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <it.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{it.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          {inputType === "message" && (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the message you want to check..."
              className="min-h-[140px] resize-y text-base leading-relaxed rounded-2xl"
              autoFocus
            />
          )}

          {inputType === "link" && (
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canScan() && handleScan()}
                placeholder="https://suspicious-link.com"
                className="pl-10 h-12 text-base rounded-2xl"
                autoFocus
              />
            </div>
          )}

          {inputType === "screenshot" && (
            <div className="space-y-3">
              {previewUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-border/50">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain bg-muted/30" />
                  <button onClick={clearImage} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-border/50 p-8 text-center hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload a screenshot</p>
                  <p className="text-xs text-muted-foreground mt-1">Take a screenshot of the message or link</p>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
          )}

          <Button
            onClick={handleScan}
            disabled={!canScan()}
            className="w-full h-12 text-base gap-2 bg-gradient-to-r from-primary to-primary/80 rounded-2xl"
          >
            <Send className="w-5 h-5" /> Check It!
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {scanning && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl animate-bounce">🔍</span>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Checking if this is safe...</p>
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {result && !scanning && risk && (
        <div className="space-y-4 animate-bounce-in">
          <div className={`rounded-2xl border-2 ${risk.border} ${risk.bg} p-5 text-center`}>
            <div className="text-5xl mb-2">{risk.emoji}</div>
            <h2 className={`text-xl font-bold ${risk.color}`}>{result.title}</h2>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-4">
            <p className="text-sm leading-relaxed">{result.explanation}</p>
          </div>

          {result.what_to_do?.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5">📋 What you should do</h3>
              {result.what_to_do.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          )}

          {result.tell_parent && (
            <div className="rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 p-4 text-center space-y-2">
              <Heart className="w-6 h-6 text-pink-500 mx-auto" />
              <p className="text-sm font-medium">You should tell a parent about this.</p>
              <p className="text-xs text-muted-foreground">Use the Ask a Parent button to send them a message right now.</p>
            </div>
          )}

          <Button onClick={reset} variant="outline" className="w-full h-11 gap-2 rounded-2xl">
            <RotateCcw className="w-4 h-4" /> Check Something Else
          </Button>
        </div>
      )}

      {error && !scanning && (
        <div className="text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}