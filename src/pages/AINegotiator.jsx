import React, { useState, useEffect } from "react";
import { MessageCircle, Loader2, Send, Zap, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCreditStatus } from "@/lib/credits";

const CREDIT_COST = 3;
const EXAMPLES = [
  "Someone is selling an iPhone on Facebook Marketplace for $200, way below retail price",
  "A person I met on a dating app claims to be a crypto trader and wants to 'help me invest'",
  "A seller on eBay wants me to pay via wire transfer instead of through the platform",
  "A 'landlord' is renting an apartment below market rate and wants a deposit before viewing",
];

export default function AINegotiator() {
  const [situation, setSituation] = useState("");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleGenerate = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setError(null);
    setQuestions(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("generateNegotiatorQuestions", {
        situation: situation.trim(),
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      setQuestions(response.data?.questions || []);
      if (response.data?.credits_remaining != null) {
        setCredits((prev) => (prev ? { ...prev, remaining: response.data.credits_remaining } : prev));
      }
    } catch (e) {
      setError(e.message || "Failed to generate questions.");
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = credits && credits.remaining >= CREDIT_COST;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">AI Negotiator</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Not sure if a seller is legitimate? Describe the situation and get 5 questions that will expose a scammer.
        </p>
      </div>

      {/* Input */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Describe the situation</label>
          <Textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. Someone is selling a used car on Craigslist for $2,000 below market value and wants me to wire a deposit..."
            className="min-h-[120px] resize-none"
          />
        </div>

        {/* Examples */}
        {!questions && !loading && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Or try an example:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setSituation(ex)}
                  className="text-xs text-left px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
                >
                  {ex.length > 50 ? ex.slice(0, 50) + "..." : ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            <span>Costs {CREDIT_COST} credits</span>
            {credits && <span>· {credits.remaining} remaining</span>}
          </div>
          <Button onClick={handleGenerate} disabled={loading || !situation.trim() || !canGenerate} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Generating..." : "Generate 5 Questions"}
          </Button>
        </div>

        {credits && !canGenerate && situation.trim() && (
          <div className="flex items-center justify-between gap-3 bg-destructive/5 border border-destructive/20 rounded-xl p-3">
            <p className="text-xs text-destructive">Not enough credits. You need {CREDIT_COST} but have {credits.remaining}.</p>
            <Button size="sm" asChild>
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-card rounded-2xl border border-border/50 p-8 flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Crafting your questions...</p>
            <p className="text-xs text-muted-foreground">Tailoring 5 questions to expose a scammer</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && questions && questions.length > 0 && (
        <div className="space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">5 Questions to Ask</h2>
          </div>
          {questions.map((q, i) => (
            <QuestionCard key={i} question={q} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question, index }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-relaxed">{question.question}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-14 space-y-3 animate-fade-in">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Why it works</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{question.why_it_works}</p>
          </div>
          {question.red_flag_answer && (
            <div className="flex items-start gap-2 bg-destructive/5 border border-destructive/15 rounded-xl p-3">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
              <div>
                <p className="text-xs font-semibold text-destructive mb-0.5">Red flag (likely scam)</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{question.red_flag_answer}</p>
              </div>
            </div>
          )}
          {question.green_flag_answer && (
            <div className="flex items-start gap-2 bg-success/5 border border-success/15 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-success" />
              <div>
                <p className="text-xs font-semibold text-success mb-0.5">Green flag (likely genuine)</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{question.green_flag_answer}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}