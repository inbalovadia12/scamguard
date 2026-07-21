import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Globe } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const SCAM_TYPES = [
  { value: "phishing_email", label: "Phishing Email" },
  { value: "smishing", label: "SMS / Text Scam" },
  { value: "romance", label: "Romance Scam" },
  { value: "crypto_investment", label: "Crypto / Investment Scam" },
  { value: "marketplace", label: "Marketplace Scam" },
  { value: "tech_support", label: "Tech Support Scam" },
  { value: "fake_job", label: "Fake Job Offer" },
  { value: "delivery", label: "Delivery Scam" },
  { value: "lottery_prize", label: "Lottery / Prize Scam" },
  { value: "government_impersonation", label: "Government Impersonation" },
  { value: "bank_impersonation", label: "Bank Impersonation" },
  { value: "other", label: "Other" },
];

const CHANNELS = [
  { value: "", label: "Not specified" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "phone_call", label: "Phone Call" },
  { value: "social_media", label: "Social Media" },
  { value: "marketplace", label: "Marketplace" },
  { value: "website", label: "Website" },
  { value: "in_person", label: "In Person" },
  { value: "other", label: "Other" },
];

export default function ShareStoryDialog({ open, onOpenChange, onSubmitted }) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [scamType, setScamType] = useState("");
  const [channel, setChannel] = useState("");
  const [country, setCountry] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const canSubmit = title.trim() && story.trim() && scamType;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.CommunityStory.create({
        title: title.trim(),
        story: story.trim(),
        scam_type: scamType,
        channel: channel || undefined,
        country: country.trim() || undefined,
        anonymous,
        author_name: anonymous ? "Anonymous" : (user.full_name || user.email?.split("@")[0] || "Member"),
        likes_count: 0,
        status: "active",
      });
      toast({ title: "Story shared!", description: "Your experience is now helping protect others." });
      setTitle(""); setStory(""); setScamType(""); setChannel(""); setCountry(""); setAnonymous(false);
      onOpenChange(false);
      onSubmitted?.();
    } catch (e) {
      toast({ title: "Failed to share", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Share Your Scam Experience
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
            <Globe className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your story is added to our community database where AI uses it as real-world data to improve scam detection for everyone. Do not include personal information or sensitive details.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Almost fell for a fake crypto trader on Instagram" maxLength={120} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="story">Your Experience *</Label>
            <Textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} placeholder="Describe what happened, how the scam worked, and how you spotted it..." className="min-h-[120px] resize-none" maxLength={2000} />
            <p className="text-xs text-muted-foreground text-right">{story.length}/2000</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Scam Type *</Label>
              <select value={scamType} onChange={(e) => setScamType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Select type...</option>
                {SCAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g., Israel" maxLength={50} />
            </div>
            <div className="space-y-2 flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="w-4 h-4 rounded border-input accent-primary" />
                <span className="text-sm">Post anonymously</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Share Story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}