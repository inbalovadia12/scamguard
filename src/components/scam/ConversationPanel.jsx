import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  MessagesSquare, Loader2, AlertTriangle, ShieldCheck, ShieldAlert,
  TrendingUp, Sparkles, History, ChevronRight, Clock, Lightbulb,
  Target, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCreditStatus, incrementCreditUsage, CREDIT_COSTS } from "@/lib/credits";
import { formatDistanceToNow } from "date-fns";
import AIDisclaimer from "@/components/AIDisclaimer";
import PlanGate from "@/components/PlanGate";

const CONVERSATION_TYPES = [
  { value: "sms", label: "SMS / Text Messages" },
  { value: "whatsapp", label: "WhatsApp Chat" },
  { value: "email", label: "Email Thread" },
  { value: "phone", label: "Phone Call Notes" },
  { value: "social_media", label: "Social Media DMs" },
  { value: "dating", label: "Dating App Chat" },
  { value: "other", label: "Other Conversation" },
];

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", dot: "bg-success", label: "Low Risk" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", dot: "bg-warning", label: "Medium Risk" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", dot: "bg-destructive", label: "High Risk" },
};

const MAX_CHARS = 10000;

export default function ConversationPanel() {
  const [transcript, setTranscript] = useState("");
  const [conversationType, setConversationType] = useState("sms");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [creditStatus, setCreditStatus] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getCreditStatus().then((s) => {
      setCreditStatus(s);
      setCheckingPlan(false);
    });
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await base44.entities.ConversationAnalysis.list("-created_date", 10);
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const langName = { en: "English", he: "Hebrew", es: "Spanish" }[lang] || "English";
      const typeLabel = CONVERSATION_TYPES.find((t) => t.value === conversationType)?.label || "Unknown";

      const prompt = `You are Vardin, an AI scam detection assistant. A user has pasted an entire chat conversation for analysis. Unlike single-message checks, you analyze the FULL conversation to detect patterns, escalation, and manipulation tactics that only emerge across multiple messages.

Conversation type: ${typeLabel}

TRANSCRIPT:
"""
${transcript.trim().slice(0, MAX_CHARS)}
"""

Analyze the entire conversation as a whole. Look for:
- ESCALATION: Does the other party increase pressure, urgency, or emotional manipulation over time?
- GROOMING: Trust-building phases followed by sudden requests for money, info, or favors
- REPEATED REQUESTS: Multiple asks for money, gift cards, crypto, personal info, or remote access
- INCONSISTENCIES: Contradictions in their story, identity, or claims
- INFORMATION HARVESTING: Slowly collecting personal details across messages
- ISOLATION: Attempts to separate the person from family, friends, or support networks
- TOO GOOD TO BE TRUE: Unrealistic promises, guaranteed returns, sudden windfalls

Respond with:
- is_likely_scam: boolean — does this conversation show scam patterns?
- overall_risk: "low", "medium", or "high"
- risk_score: 0-100 (100 = definitely a scam, based on cumulative patterns)
- patterns_detected: array of manipulation patterns detected (e.g., "Love bombing followed by financial request", "Gradual urgency escalation", "Isolation from family")
- red_flag_messages: array of strings, each describing a specific suspicious message and WHY it's a red flag
- escalation_summary: 2-3 sentences describing how the conversation progressed and escalated over time
- what_they_want: what the scammer is ultimately trying to get from the victim
- recommended_actions: 3-5 specific steps the user should take based on what happened
- summary: 2-3 sentence overall assessment

Respond entirely in ${langName}.`;

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            is_likely_scam: { type: "boolean" },
            overall_risk: { type: "string", enum: ["low", "medium", "high"] },
            risk_score: { type: "number" },
            patterns_detected: { type: "array", items: { type: "string" } },
            red_flag_messages: { type: "array", items: { type: "string" } },
            escalation_summary: { type: "string" },
            what_they_want: { type: "string" },
            recommended_actions: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
        },
      });

      setResult(analysis);

      try {
        const record = await base44.entities.ConversationAnalysis.create({
          transcript: transcript.trim().slice(0, MAX_CHARS),
          conversation_type: conversationType,
          overall_risk: analysis.overall_risk,
          risk_score: analysis.risk_score,
          is_likely_scam: analysis.is_likely_scam,
          patterns_detected: analysis.patterns_detected || [],
          red_flag_messages: analysis.red_flag_messages || [],
          escalation_summary: analysis.escalation_summary || "",
          what_they_want: analysis.what_they_want || "",
          recommended_actions: analysis.recommended_actions || [],
          summary: analysis.summary || "",
        });
        setHistory((prev) => [record, ...prev].slice(0, 10));
      } catch {}

      try {
        await incrementCreditUsage(CREDIT_COSTS.CONVERSATION_ANALYSIS);
        setCreditStatus(await getCreditStatus());
      } catch {}
    } catch (e) {
      setError(e.message || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectHistory = (item) => {
    setResult({
      is_likely_scam: item.is_likely_scam,
      overall_risk: item.overall_risk,
      risk_score: item.risk_score,
      patterns_detected: item.patterns_detected || [],
      red_flag_messages: item.red_flag_messages || [],
      escalation_summary: item.escalation_summary || "",
      what_they_want: item.what_they_want || "",
      recommended_actions: item.recommended_actions || [],
      summary: item.summary || "",
    });
    setTranscript(item.transcript || "");
    setConversationType(item.conversation_type || "other");
  };

  if (checkingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (creditStatus && !creditStatus.isPaid) {
    return (
      <PlanGate
        icon={MessagesSquare}
        title="Conversation Analyzer"
        description="Paste an entire chat conversation to detect scam patterns, escalation, and manipulation over time."
        plan="Plus"
      />
    );
  }

  const charCount = transcript.length;
  const overLimit = charCount > MAX_CHARS;
  const canAnalyze = transcript.trim().length > 20 && !analyzing && !overLimit && creditStatus?.canAnalyze;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-3 sm:p-4 rounded-2xl bg-primary/5 border border-primary/20 animate-slide-up">
        <TrendingUp className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm min-w-0">
          <p className="font-medium text-primary">Detects patterns across the whole conversation</p>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">Scams often escalate gradually — this looks at the full timeline to catch grooming, repeated requests, and manipulation that single-message checks miss.</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5 space-y-4 animate-slide-up">
        <div>
          <label className="text-sm font-medium mb-2 block">Conversation type</label>
          <Select value={conversationType} onValueChange={setConversationType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONVERSATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Paste the full conversation</label>
            <span className={overLimit ? "text-xs text-destructive font-medium" : "text-xs text-muted-foreground"}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`Paste the entire conversation here. Include all messages in order, e.g.:\n\n[10:00 AM] Them: Hi! I saw your profile and you seem amazing...\n[10:05 AM] You: Thanks! How are you?\n[10:06 AM] Them: I'm great! I'm an oil rig engineer working offshore...\n\nOr just paste it as-is — the AI will figure out who said what.`}
            className="min-h-[180px] sm:min-h-[220px] resize-y text-sm leading-relaxed"
            disabled={analyzing}
          />
          {overLimit && (
            <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Too long — please trim to under {MAX_CHARS.toLocaleString()} characters.
            </p>
          )}
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="w-full gap-2 h-11 bg-gradient-to-r from-primary to-primary/80"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? "Analyzing patterns..." : "Analyze Conversation"}
        </Button>

        {creditStatus && !creditStatus.canAnalyze && (
          <p className="text-xs text-warning text-center flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            You're out of AI credits for this month.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <AIDisclaimer />

      {/* Loading Skeleton */}
      {analyzing && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
            <div className="h-5 w-48 bg-muted rounded animate-pulse" />
            <div className="h-3 w-full bg-muted/50 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-muted animate-pulse flex-shrink-0" />
                <div className="h-3 flex-1 bg-muted/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reading the full conversation for patterns...
          </p>
        </div>
      )}

      {/* Results */}
      {result && !analyzing && (
        <div className="space-y-4 animate-slide-up">
          <div className={`rounded-2xl border-2 ${RISK_CONFIG[result.overall_risk]?.border || "border-border/50"} ${RISK_CONFIG[result.overall_risk]?.bg} p-4 sm:p-5`}>
            <div className="flex items-center gap-3">
              {result.is_likely_scam ? (
                <ShieldAlert className={`w-7 h-7 ${RISK_CONFIG[result.overall_risk]?.color}`} />
              ) : (
                <ShieldCheck className={`w-7 h-7 ${RISK_CONFIG[result.overall_risk]?.color}`} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-base font-bold ${RISK_CONFIG[result.overall_risk]?.color}`}>
                  {result.is_likely_scam ? "Scam Patterns Detected" : "No Clear Scam Patterns"}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {RISK_CONFIG[result.overall_risk]?.label}
                  {result.risk_score != null && <span className="opacity-70"> · Score: {result.risk_score}/100</span>}
                </p>
              </div>
            </div>
          </div>

          {result.summary && (
            <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Assessment</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
            </div>
          )}

          {result.patterns_detected?.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Patterns Detected Over Time</h3>
              </div>
              <div className="space-y-2">
                {result.patterns_detected.map((pattern, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                    <span className="text-foreground/90 leading-relaxed">{pattern}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.red_flag_messages?.length > 0 && (
            <div className="bg-card rounded-2xl border border-warning/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Flag className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold">Red Flag Messages</h3>
              </div>
              <div className="space-y-3">
                {result.red_flag_messages.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-border/30 last:border-0 last:pb-0">
                    <div className="w-6 h-6 rounded-lg bg-warning/10 text-warning flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed pt-0.5">{flag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.escalation_summary && (
            <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">How It Escalated</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.escalation_summary}</p>
            </div>
          )}

          {result.what_they_want && (
            <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-destructive" />
                <h3 className="text-sm font-semibold">What They're After</h3>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{result.what_they_want}</p>
            </div>
          )}

          {result.recommended_actions?.length > 0 && (
            <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">What You Should Do Now</h3>
              </div>
              <div className="space-y-2.5">
                {result.recommended_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed pt-0.5">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Link to="/emergency-response" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Get Emergency Help
              </Button>
            </Link>
            <Link to="/community" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <Flag className="w-3.5 h-3.5" /> Report This Scam
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Past Analyses</h2>
          </div>
          <div className="space-y-2">
            {history.map((item) => {
              const riskCfg = RISK_CONFIG[item.overall_risk];
              const typeLabel = CONVERSATION_TYPES.find((t) => t.value === item.conversation_type)?.label || "Conversation";
              const iconBg = riskCfg ? riskCfg.bg : "bg-muted";
              const iconColor = riskCfg ? riskCfg.color : "text-muted-foreground";
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectHistory(item)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/50 bg-card hover:bg-muted/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                      <MessagesSquare className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.summary || `${typeLabel} analysis`}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(item.created_date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {riskCfg && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>
                        {riskCfg.label.replace(" Risk", "")}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}