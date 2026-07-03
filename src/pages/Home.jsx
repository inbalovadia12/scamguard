import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Loader2, ArrowRight, MessageSquare, Mail, Briefcase, ShoppingCart,
  Heart, Landmark, HelpCircle, Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import AnalysisResult from "@/components/scam/AnalysisResult";
import { getCreditStatus, incrementCreditUsage } from "@/lib/credits";

const messageTypes = [
  { value: "sms", label: "SMS / Text", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "job_offer", label: "Job Offer", icon: Briefcase },
  { value: "marketplace", label: "Marketplace Listing", icon: ShoppingCart },
  { value: "romance", label: "Romance / Dating", icon: Heart },
  { value: "bank_government", label: "Bank / Government", icon: Landmark },
  { value: "tech_support", label: "Tech Support", icon: HelpCircle },
  { value: "other", label: "Other", icon: Shield },
];

export default function Home() {
  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState("sms");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleAnalyze = async () => {
    if (!messageText.trim()) return;
    if (credits && !credits.canAnalyze) return;

    setAnalyzing(true);
    setResult(null);

    const prompt = `You are a scam detection expert. Analyze the following message and determine if it's a scam.

Message type: ${messageType}
Message: "${messageText}"

IMPORTANT RULES:
- Never say "definitely a scam" — use "highly likely" or "likely" language
- Be educational and explain in plain English
- Focus on specific manipulation tactics used

Respond in this exact JSON format:
{
  "risk_level": "low" | "medium" | "high",
  "risk_score": <number 0-100>,
  "explanation": "<2-3 sentence plain-English explanation of why this is or isn't suspicious>",
  "tactics_detected": ["<tactic name>"],
  "next_steps": ["<action item>"],
  "why_scammers_do_this": "<educational explanation of the scam tactic pattern>",
  "what_they_want": "<what the scammer is trying to get from you>",
  "what_to_say": "<suggested response if contacted again>"
}

For tactics_detected, use these standard names when applicable: "Urgency", "Authority Impersonation", "Scarcity", "Love Bombing", "Payment Red Flags"
For next_steps, use these when applicable: "Do not reply", "Block sender", "Report to carrier"
Add more specific next_steps as needed.`;

    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          risk_level: { type: "string", enum: ["low", "medium", "high"] },
          risk_score: { type: "number" },
          explanation: { type: "string" },
          tactics_detected: { type: "array", items: { type: "string" } },
          next_steps: { type: "array", items: { type: "string" } },
          why_scammers_do_this: { type: "string" },
          what_they_want: { type: "string" },
          what_to_say: { type: "string" },
        },
      },
    });

    await base44.entities.ScamAnalysis.create({
      message_text: messageText,
      message_type: messageType,
      ...llmResult,
    });

    await incrementCreditUsage();
    const updated = await getCreditStatus();
    setCredits(updated);

    setResult(llmResult);
    setAnalyzing(false);
  };

  const handleReset = () => {
    setMessageText("");
    setResult(null);
  };

  const outOfCredits = credits && !credits.canAnalyze;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Credit Counter */}
      {credits && !result && (
        <div className="flex items-center justify-between mb-6 px-4 py-2.5 bg-muted rounded-xl">
          <span className="text-sm text-muted-foreground">
            {credits.isPremium ? "👑 Premium" : "Free"} plan
          </span>
          <span className="text-sm font-medium">
            {credits.remaining} / {credits.limit} credits left this month
          </span>
        </div>
      )}

      {/* Out of credits paywall */}
      {outOfCredits && !result && (
        <div className="mb-6 p-6 rounded-2xl bg-warning/10 border border-warning/20 text-center space-y-3">
          <Lock className="w-8 h-8 text-warning mx-auto" />
          <h3 className="font-semibold">You're out of AI credits</h3>
          <p className="text-sm text-muted-foreground">
            You've used all {credits.limit} of your free monthly credits. Upgrade to Premium for 100
            analyses per month plus image upload, the Chrome extension, and more.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600">
              <Shield className="w-4 h-4" />
              Upgrade to Premium
            </Button>
          </Link>
        </div>
      )}

      {!result ? (
        <div className="space-y-8">
          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Check a Suspicious Message</h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Paste any message you've received and we'll analyze it for scam patterns instantly.
            </p>
          </div>

          {/* Input Area */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Message Type</label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {messageTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Paste the message</label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Paste the suspicious message here..."
                className="min-h-[160px] text-base resize-none rounded-xl"
                disabled={outOfCredits}
              />
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!messageText.trim() || analyzing || outOfCredits}
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20"
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing message...
                </>
              ) : (
                <>
                  Analyze Message
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>🔒 Messages are not stored without consent</span>
            <span>⚡ Instant AI analysis</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Analysis Result</h1>
            <Button variant="outline" onClick={handleReset}>
              Check another
            </Button>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Original message
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {messageText}
            </p>
          </div>

          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6">
            <AnalysisResult analysis={result} />
          </div>
        </div>
      )}
    </div>
  );
}