import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Feedback() {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Feedback.create({
        content: content.trim(),
        category,
        rating: rating || undefined,
        user_email: user.email,
        user_name: user.full_name,
        status: "new",
      });
      setSubmitted(true);
      setContent("");
      setRating(0);
      setCategory("general");
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
    } catch (err) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-xl font-bold font-heading">Feedback Sent!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Thank you for taking the time to share your thoughts. We read every piece of feedback.
        </p>
        <Button onClick={() => setSubmitted(false)} variant="outline" className="gap-2">
          <MessageSquare className="w-4 h-4" />
          Submit Another
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Share Feedback</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Found a bug? Have a feature idea? Want to tell us how we're doing? We'd love to hear from you.
        </p>
      </div>

      <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Feedback</SelectItem>
              <SelectItem value="bug">Bug Report</SelectItem>
              <SelectItem value="feature_request">Feature Request</SelectItem>
              <SelectItem value="praise">Praise / Appreciation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Rating (optional)</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? 0 : n)}
                className="p-1"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    n <= rating ? "fill-warning text-warning" : "text-muted-foreground/40 hover:text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Your Feedback</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tell us what you think..."
            className="min-h-[160px] text-base resize-none rounded-xl"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="w-full h-11 bg-gradient-to-r from-primary to-primary/80"
        >
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Submit Feedback
        </Button>
      </div>
    </div>
  );
}