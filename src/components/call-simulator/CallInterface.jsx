import React, { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Send, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function CallInterface({ scenario, conversation, setConversation, onEndCall }) {
  const [userInput, setUserInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [tacticsUsed, setTacticsUsed] = useState([]);
  const [callEnded, setCallEnded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, waiting]);

  const handleSend = async () => {
    if (!userInput.trim() || waiting || callEnded) return;
    const userMessage = { speaker: "user", text: userInput.trim() };
    const updatedConvo = [...conversation, userMessage];
    setConversation(updatedConvo);
    setUserInput("");
    setWaiting(true);
    setFeedback(null);

    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("simulateScamCall", {
        action: "respond",
        scenario_id: scenario.id,
        conversation: updatedConvo,
        language: lang,
      });

      const data = response.data;
      if (data.error) throw new Error(data.error);

      // Show user feedback
      setFeedback(data.user_assessment);

      // Track tactic
      if (data.tactic_used && !tacticsUsed.includes(data.tactic_used)) {
        setTacticsUsed([...tacticsUsed, data.tactic_used]);
      }

      // If scammer has a reply, add it to conversation
      if (data.scammer_line) {
        const scammerMessage = { speaker: "scammer", text: data.scammer_line, tactic: data.tactic_used };
        setConversation([...updatedConvo, scammerMessage]);
      }

      // If call should not continue, auto-end
      if (!data.should_continue) {
        setCallEnded(true);
        setTimeout(() => onEndCall([...updatedConvo, ...(data.scammer_line ? [{ speaker: "scammer", text: data.scammer_line }] : [])]), 1500);
      }
    } catch (e) {
      setFeedback({
        feedback: "Connection error. Try sending your message again.",
        fell_for_tactic: false,
        shared_sensitive_info: false,
        challenged_scammer: false,
        identified_scam: false,
      });
    } finally {
      setWaiting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleEndCall = () => {
    setCallEnded(true);
    onEndCall(conversation);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)] max-h-[700px]">
      {/* Call header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card rounded-t-2xl border border-border/50 border-b-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${scenario.avatar_color} flex items-center justify-center text-xl flex-shrink-0`}>
            {scenario.avatar_emoji}
            {!callEnded && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{scenario.caller_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {callEnded ? (
                <><PhoneOff className="w-3 h-3" /> Call ended</>
              ) : waiting ? (
                <><span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Speaking...</>
              ) : (
                <><span className="inline-block w-1.5 h-1.5 rounded-full bg-success" /> Connected</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Phone className="w-3 h-3" />
            Live
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/10 border-x border-border/50">
        {conversation.map((msg, i) => (
          <div key={i} className={`flex ${msg.speaker === "user" ? "justify-end" : "justify-start"} animate-slide-up`}>
            <div className={`max-w-[80%] sm:max-w-[70%] ${msg.speaker === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {msg.tactic && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70 px-1">
                  Tactic: {msg.tactic}
                </span>
              )}
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.speaker === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border/50 rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {waiting && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-card border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Feedback banner */}
        {feedback && !waiting && (
          <div className="animate-slide-up px-1">
            <div className={`rounded-xl border p-3 space-y-1.5 ${
              feedback.shared_sensitive_info
                ? "bg-destructive/5 border-destructive/20"
                : feedback.challenged_scammer || feedback.identified_scam
                ? "bg-success/5 border-success/20"
                : feedback.fell_for_tactic
                ? "bg-warning/5 border-warning/20"
                : "bg-primary/5 border-primary/15"
            }`}>
              <div className="flex items-center gap-1.5">
                {feedback.shared_sensitive_info ? (
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                ) : feedback.challenged_scammer || feedback.identified_scam ? (
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                ) : feedback.fell_for_tactic ? (
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-primary flex-shrink-0" />
                )}
                <span className="text-xs font-semibold">
                  {feedback.shared_sensitive_info ? "Warning: Sensitive Info Shared"
                    : feedback.identified_scam ? "Great — Scam Identified!"
                    : feedback.challenged_scammer ? "Good Pushback!"
                    : feedback.fell_for_tactic ? "Careful — Showing Vulnerability"
                    : "Coach Feedback"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-5">{feedback.feedback}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-card rounded-b-2xl border border-border/50 border-t-0 p-3 space-y-2">
        {callEnded ? (
          <div className="flex items-center justify-center py-2">
            <p className="text-sm text-muted-foreground">Call ended. Loading your score...</p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-h-24"
                style={{ minHeight: "44px" }}
              />
              <Button
                onClick={handleSend}
                disabled={!userInput.trim() || waiting}
                size="icon"
                className="h-11 w-11 rounded-xl flex-shrink-0"
              >
                {waiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/60 hidden sm:block">Press Enter to send • Shift+Enter for new line</p>
              <Button
                onClick={handleEndCall}
                variant="outline"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
                disabled={waiting}
              >
                <PhoneOff className="w-3.5 h-3.5" />
                End Call
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}