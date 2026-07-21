import React, { useState } from "react";
import { Mail, MessageSquare, Send, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function Contact() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await base44.entities.Feedback.create({
        content: message,
        category: "general",
        user_email: email,
        user_name: name,
      });
      toast({ title: "Message sent", description: "We'll get back to you soon." });
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background luxury-mesh">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-12 animate-slide-up">
          <div className="w-16 h-16 rounded-2xl luxury-gradient-btn flex items-center justify-center mx-auto shadow-lg shadow-primary/20 mb-6">
            <Mail className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading mb-4">
            Contact Us
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Have a question, suggestion, or scam to report? We'd love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
          {/* Contact methods */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Email</h3>
              </div>
              <p className="text-sm text-muted-foreground">support@vardin.app</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">In-App Feedback</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Use the feedback page inside the app to report bugs or suggest features directly.
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Report a Scam</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Submit suspicious messages through the Check or Scam Feed pages to help the
                community stay informed.
              </p>
            </div>
          </div>

          {/* Contact form */}
          <div className="md:col-span-3">
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  rows={5}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80">
                {submitting ? "Sending..." : (<><Send className="w-4 h-4" /> Send Message</>)}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}