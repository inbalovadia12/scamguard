import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, ShieldCheck, Lock, X, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import MessageBubble from "@/components/agent/MessageBubble";
import ImageUpload from "@/components/scam/ImageUpload";
import ConversationSidebar from "@/components/agent/ConversationSidebar";
import { getCreditStatus, incrementCreditUsage } from "@/lib/credits";
import { toast } from "@/components/ui/use-toast";

export default function AgentChat() {
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [credits, setCredits] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const loadConversations = async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: "scam_analyzer" });
      setConversations(list || []);
      return list || [];
    } finally {
      setLoadingConvs(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const creditStatus = await getCreditStatus();
      setCredits(creditStatus);
      if (!creditStatus.isPremium) { setLoading(false); return; }

      const list = await loadConversations();
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

  const handleSelectConversation = async (convId) => {
    setSidebarOpen(false);
    const conv = await base44.agents.getConversation(convId);
    setConversation(conv);
    setMessages(conv.messages || []);
  };

  const handleNewConversation = async () => {
    setSidebarOpen(false);
    const conv = await base44.agents.createConversation({
      agent_name: "scam_analyzer",
      metadata: { name: "New Chat" },
    });
    setConversation(conv);
    setMessages([]);
    setConversations([conv, ...conversations]);
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await base44.agents.deleteConversation?.(convId);
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);
      if (conversation?.id === convId) {
        if (updated.length > 0) {
          handleSelectConversation(updated[0].id);
        } else {
          setConversation(null);
          setMessages([]);
        }
      }
      toast({ title: "Conversation deleted" });
    } catch (e) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
    }
  };

  const handleImageSelect = (file) => {
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || sending) return;
    if (!credits?.canAnalyze) return;

    setSending(true);
    const messageContent = input.trim();
    setInput("");

    let fileUrls = [];
    if (selectedImage) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedImage });
      fileUrls = [file_url];
      handleImageSelect(null);
    }

    await base44.agents.addMessage(conversation, {
      role: "user",
      content: messageContent || "Please analyze this screenshot for scam indicators.",
      file_urls: fileUrls.length > 0 ? fileUrls : undefined,
    });

    // Update conversation name if it's still "New Chat"
    if (conversation?.metadata?.name === "New Chat" && messageContent) {
      const title = messageContent.slice(0, 40) + (messageContent.length > 40 ? "…" : "");
      try {
        await base44.agents.updateConversation(conversation.id, { metadata: { name: title } });
        setConversation({ ...conversation, metadata: { ...conversation.metadata, name: title } });
        setConversations(conversations.map((c) => c.id === conversation.id ? { ...c, metadata: { ...c.metadata, name: title } } : c));
      } catch {}
    }

    await incrementCreditUsage();
    const updated = await getCreditStatus();
    setCredits(updated);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (credits && !credits.isPremium) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-warning/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Premium Feature</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The AI Agent Chat with image upload is a paid feature. Upgrade to chat with
            Vardin's AI, upload suspicious screenshots, and get real-time analysis.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              <ShieldCheck className="w-4 h-4" />
              Upgrade Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (credits && !credits.canAnalyze) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-warning/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Out of AI Credits</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            You've used all {credits.limit} of your monthly AI credits. Your credits reset next month, or upgrade for more.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              <ShieldCheck className="w-4 h-4" />
              Manage Subscription
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex overflow-hidden rounded-2xl border border-border/50 bg-background">
      {/* Sidebar - desktop */}
      <div className="hidden md:flex">
        <ConversationSidebar
          conversations={conversations}
          activeId={conversation?.id}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          loading={loadingConvs}
        />
      </div>

      {/* Sidebar - mobile slide-in */}
      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="md:hidden fixed left-0 top-0 bottom-0 z-50 animate-slide-in-right">
            <ConversationSidebar
              conversations={conversations}
              activeId={conversation?.id}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={handleDeleteConversation}
              loading={loadingConvs}
            />
          </div>
        </>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight font-heading text-sm">Vardin AI</h1>
              <p className="text-xs text-muted-foreground">{conversation?.metadata?.name || "New Chat"}</p>
            </div>
          </div>
          {credits && (
            <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              {credits.remaining} / {credits.limit} credits left
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-semibold text-lg font-heading">Ask Vardin AI</h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Paste a suspicious message, upload a screenshot, or ask a question about scams.
                I'll analyze it and explain what to do.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 space-y-2 p-3 border-t border-border/50">
          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="rounded-xl max-h-24" />
              <button
                onClick={() => handleImageSelect(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-card rounded-2xl border border-border/50 p-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste a message or ask about a scam..."
              className="border-0 resize-none min-h-[44px] max-h-32 focus-visible:ring-0 bg-transparent"
              rows={1}
            />
            <div className="flex items-center gap-1 pb-1">
              <ImageUpload onImageSelected={handleImageSelect} />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage) || sending}
                size="icon"
                className="rounded-xl bg-gradient-to-r from-primary to-primary/80"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}