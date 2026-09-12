import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, X, Menu } from "lucide-react";
import MessageBubble from "@/components/agent/MessageBubble";
import ImageUpload from "@/components/scam/ImageUpload";
import ConversationSidebar from "@/components/agent/ConversationSidebar";
import AIDisclaimer from "@/components/AIDisclaimer";
import LockedFeature from "@/components/LockedFeature";
import { getCreditStatus, incrementCreditUsage, CREDIT_COSTS } from "@/lib/credits";
import { toast } from "@/components/ui/use-toast";

export default function AgentChat() {
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
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
    let cancelled = false;

    const init = async () => {
      try {
        const creditStatus = await getCreditStatus();
        if (cancelled) return;
        setCredits(creditStatus);

        const list = await loadConversations();
        if (cancelled) return;

        if (list && list.length > 0) {
          try {
            const conv = await base44.agents.getConversation(list[0].id);
            if (!cancelled) {
              setConversation(conv);
              setMessages(conv.messages || []);
            }
          } catch {
            // Keep the assistant usable even if an older conversation cannot be loaded.
            if (!cancelled) {
              setConversation(null);
              setMessages([]);
            }
          }
        }
      } catch (error) {
        // A credit/conversation API failure must never blank the entire assistant page.
        if (!cancelled) {
          setCredits(null);
          setConversations([]);
          setConversation(null);
          setMessages([]);
          toast({
            title: "Vardin AI is ready",
            description: "Your chat history could not be loaded, but you can start a new conversation.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
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
      setSelectedImages((prev) => [...prev, file].slice(0, 2));
      setImagePreviews((prev) => [...prev, URL.createObjectURL(file)].slice(0, 2));
    }
  };

  const handleRemoveImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedImages.length === 0) || sending) return;
    const cost = CREDIT_COSTS.MESSAGE + (selectedImages.length * CREDIT_COSTS.IMAGE_UPLOAD);
    if (credits && credits.remaining < cost) return;

    setSending(true);
    const messageContent = input.trim();
    setInput("");

    try {
      let activeConversation = conversation;
      if (!activeConversation) {
        activeConversation = await base44.agents.createConversation({
          agent_name: "scam_analyzer",
          metadata: { name: "New Chat" },
        });
        setConversation(activeConversation);
        setConversations((prev) => [activeConversation, ...prev]);
      }

      let fileUrls = [];
      for (const img of selectedImages) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: img });
        fileUrls.push(file_url);
      }
      setSelectedImages([]);
      setImagePreviews([]);

      await base44.agents.addMessage(activeConversation, {
        role: "user",
        content: messageContent || "Please analyze this screenshot for scam indicators.",
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
      });

      // Update conversation name if it's still "New Chat"
      if (activeConversation?.metadata?.name === "New Chat" && messageContent) {
        const title = messageContent.slice(0, 40) + (messageContent.length > 40 ? "…" : "");
        try {
          await base44.agents.updateConversation(activeConversation.id, { metadata: { name: title } });
          setConversation((prev) => prev?.id === activeConversation.id
            ? { ...prev, metadata: { ...prev.metadata, name: title } }
            : prev);
          setConversations((prev) => prev.map((c) => c.id === activeConversation.id
            ? { ...c, metadata: { ...c.metadata, name: title } }
            : c));
        } catch {}
      }

      await incrementCreditUsage(cost);
      const updated = await getCreditStatus();
      setCredits(updated);
    } catch (e) {
      toast({ title: "Could not send message", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
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

  if (credits && credits.remaining < CREDIT_COSTS.MESSAGE) {
    return (
      <LockedFeature
        title="Not Enough Credits"
        description={`You have ${credits.remaining} total credits left${credits.adminCreditBalance > 0 ? `, including ${credits.adminCreditBalance} admin bonus` : ""}. Each message uses ${CREDIT_COSTS.MESSAGE} credits. Monthly credits reset next month, or upgrade for more.`}
        buttonLabel="Manage Subscription"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100dvh-7rem)] md:h-[calc(100dvh-9rem)] min-h-[520px] flex overflow-hidden rounded-2xl border border-border/50 bg-background">
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
          <div className="md:hidden fixed left-0 top-0 bottom-0 z-50 animate-slide-in-left shadow-xl">
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
        <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0 p-3 border-b border-border/50">
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
            <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full max-w-full truncate">
              {credits.remaining} credits left{credits.adminCreditBalance > 0 ? ` · ${credits.adminCreditBalance} bonus` : ""}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-4">
          <AIDisclaimer compact />
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
          {imagePreviews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative inline-block">
                  <img src={preview} alt={`Preview ${i + 1}`} className="rounded-xl max-h-24" />
                  <button
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
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
              <ImageUpload onImageSelected={handleImageSelect} disabled={selectedImages.length >= 2} />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && selectedImages.length === 0) || sending}
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