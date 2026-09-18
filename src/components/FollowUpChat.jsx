import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2, AlertTriangle, Zap, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Personas for the free (client-side InvokeLLM) path. The charged path uses the
// server-side continueConversation function which has its own persona copy.
const PERSONAS = {
  scam_exposer:
    "You are Vardin, an AI scam-detection assistant. The user described a situation and already received questions to ask the other party. Now they are following up — the other party replied, or the situation changed. Help them interpret the new response and decide what to ask or do next. Be practical, specific and calm. If the new information clearly indicates a scam, say so and explain why. If it seems legitimate, say so. If uncertain, give measured guidance and suggest one or two clarifying questions. Never ask the user for sensitive personal data.",
  recovery:
    "You are Vardin, an AI scam-recovery assistant. The user already received a personalized recovery plan. Now they are following up — they may have taken some steps and something new happened, or they have a question about the plan. Continue guiding them calmly and practically. Reference their original situation and the steps already given. Prioritize minimizing further loss. If they should contact a specific institution, remind them. If they mention a new loss, give immediate next steps. Never ask the user for sensitive personal data.",
  default:
    "You are Vardin, an AI scam-safety assistant. Continue helping the user with their follow-up questions based on the original context provided. Be practical, specific and calm. Never ask the user for sensitive personal data.",
};

function buildPrompt(persona, context, history, question, langName) {
  const p = PERSONAS[persona] || PERSONAS.default;
  let s = p + "\n\nRespond entirely in " + langName + ".\n\n";
  s += "=== ORIGINAL CONTEXT ===\n" + context + "\n\n";
  s += "=== CONVERSATION SO FAR ===\n";
  if (!history.length) s += "(none yet)\n";
  else history.forEach((m) => { s += (m.role === "user" ? "User: " : "Assistant: ") + m.content + "\n"; });
  s += "\n=== NEW QUESTION ===\nUser: " + question + "\n\nReply with a helpful, concise, practical answer. Use plain text (no markdown headings). Keep it focused and actionable.";
  return s;
}

const LANGUAGE_NAMES = { en: "English", he: "Hebrew", es: "Spanish" };

export default function FollowUpChat({
  persona = "default",
  context = "",
  title = "Ask a follow-up",
  placeholder = "Type your question...",
  creditCost = null,
  creditsState = null,
  onCreditsUsed = null,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Clear the conversation whenever the originating context changes (e.g., the
  // user regenerates the initial questions or recovery plan).
  useEffect(() => {
    setMessages([]);
    setError(null);
    setInput("");
  }, [context]);

  const canAfford = !creditCost || !creditsState || creditsState.remaining >= creditCost;

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!canAfford) {
      setError(`Not enough credits. You need ${creditCost} but have ${creditsState.remaining}.`);
      return;
    }
    const userMsg = { role: "user", content: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const langName = LANGUAGE_NAMES[lang] || "English";
      let reply;
      if (creditCost) {
        const res = await base44.functions.invoke("continueConversation", {
          persona,
          context,
          history: nextMessages.slice(0, -1),
          question: q,
          language: lang,
        });
        if (res.data?.error) throw new Error(res.data.error);
        reply = res.data?.reply || "";
        if (res.data?.credits_remaining != null && onCreditsUsed) {
          onCreditsUsed(res.data.credits_remaining);
        }
      } else {
        const prompt = buildPrompt(persona, context, nextMessages.slice(0, -1), q, langName);
        const res = await base44.integrations.Core.InvokeLLM({ prompt });
        reply = typeof res === "string" ? res : res?.reply || res?.text || JSON.stringify(res);
      }
      if (!reply || !reply.trim()) reply = "I couldn't generate a response. Please try rephrasing.";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
    setInput("");
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5 space-y-3 animate-slide-up">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {creditCost && (
          <span className="text-xs text-muted-foreground ml-auto inline-flex items-center gap-1">
            <Zap className="w-3 h-3" /> {creditCost} credits / reply
            {creditsState && <span className="opacity-70">· {creditsState.remaining} left</span>}
          </span>
        )}
        {messages.length > 0 && !loading && (
          <button
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
            title="Clear conversation"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {messages.length === 0
          ? "Followed the steps and something new happened? Ask a follow-up and keep getting guidance."
          : "Continue the conversation below."}
      </p>

      {messages.length > 0 && (
        <div ref={scrollRef} className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`text-sm p-2.5 rounded-2xl max-w-[85%] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "bg-primary/10 text-foreground rounded-br-sm"
                    : "bg-muted/40 text-foreground/90 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="text-sm p-2.5 rounded-2xl bg-muted/40 rounded-bl-sm inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[48px] max-h-32 resize-none text-sm"
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()} className="gap-2 h-10 flex-shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground/70">Press Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}