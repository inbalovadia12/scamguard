import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Globe, Link2 } from "lucide-react";
import MessageBubble from "@/components/agent/MessageBubble";
import LockedFeature from "@/components/LockedFeature";
import { getCreditStatus, incrementCreditUsage } from "@/lib/credits";

export default function UrlScanner() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [urlInput, setUrlInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const creditStatus = await getCreditStatus();
      setCredits(creditStatus);
      if (!creditStatus.isPaid) { setLoading(false); return; }

      const list = await base44.agents.listConversations({ agent_name: "url_scanner" });
      if (list && list.length > 0) {
        const conv = await base44.agents.getConversation(list[0].id);
        setConversation(conv);
        setMessages(conv.messages || []);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleScan = async () => {
    if (!urlInput.trim() || sending) return;
    if (!credits?.canAnalyze) return;

    setSending(true);
    const url = urlInput.trim();
    setUrlInput("");

    let conv = conversation;
    if (!conv) {
      conv = await base44.agents.createConversation({
        agent_name: "url_scanner",
        metadata: { name: url.slice(0, 40) + (url.length > 40 ? "…" : "") },
      });
      setConversation(conv);
    }

    await base44.agents.addMessage(conv, {
      role: "user",
      content: url,
    });

    await incrementCreditUsage();
    const updated = await getCreditStatus();
    setCredits(updated);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (credits && !credits.isPaid) {
    return (
      <LockedFeature
        title="URL Scanner — Paid Feature"
        description="Scan any website for scam risk by analyzing its actual content — marketplace listings, fake stores, phishing pages, and more. Available on Plus and Premium plans."
        buttonLabel="Upgrade Now"
        icon={Globe}
      />
    );
  }

  if (credits && !credits.canAnalyze) {
    return (
      <LockedFeature
        title="Out of AI Credits"
        description={`You've used all ${credits.limit} of your monthly AI credits. Your credits reset next month, or upgrade for more.`}
        buttonLabel="Manage Subscription"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Globe className="w-6 h-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">URL Scanner</h1>
        <p className="text-muted-foreground text-sm hidden sm:block">
          Paste any link — we'll fetch the website and analyze its actual content for scams.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-card rounded-2xl border border-border/50 p-2 animate-slide-up anim-delay-1">
        <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://suspicious-link.com/..."
          className="border-0 focus-visible:ring-0 bg-transparent"
          disabled={sending}
        />
        <Button
          onClick={handleScan}
          disabled={!urlInput.trim() || sending}
          size="icon"
          className="rounded-xl bg-gradient-to-r from-primary to-primary/80 flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      <div className="space-y-4 min-h-[200px]">
        {messages.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Globe className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Paste a URL above and I'll fetch the website, read its content, and tell you if it's a scam — including marketplace listings, fake stores, and phishing pages.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={msg.id || i} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {credits && (
        <div className="text-center text-xs text-muted-foreground">
          {credits.remaining} / {credits.limit} credits left
        </div>
      )}
    </div>
  );
}