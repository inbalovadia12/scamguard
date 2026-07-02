import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, Shield, Lock, X } from "lucide-react";
import { Link } from "react-router-dom";
import MessageBubble from "@/components/agent/MessageBubble";
import ImageUpload from "@/components/scam/ImageUpload";
import { getCreditStatus, incrementCreditUsage } from "@/lib/credits";

export default function AgentChat() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const creditStatus = await getCreditStatus();
      setCredits(creditStatus);

      if (!creditStatus.isPremium) {
        setLoading(false);
        return;
      }

      const existing = await base44.agents.listConversations({ agent_name: "scam_analyzer" });
      if (existing && existing.length > 0) {
        const conv = await base44.agents.getConversation(existing[0].id);
        setConversation(conv);
        setMessages(conv.messages || []);
      } else {
        const conv = await base44.agents.createConversation({
          agent_name: "scam_analyzer",
          metadata: { name: "Scam Analysis Chat" },
        });
        setConversation(conv);
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

  // Premium paywall
  if (credits && !credits.isPremium) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Premium Feature</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The AI Agent Chat with image upload is a premium feature. Upgrade to chat with
            ScamGuard's AI, upload suspicious screenshots, and get real-time analysis.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600">
              <Shield className="w-4 h-4" />
              Upgrade to Premium
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Out of credits paywall
  if (credits && !credits.canAnalyze) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Out of AI Credits</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            You've used all {credits.limit} of your monthly AI credits. Your credits reset next month,
            or upgrade for more.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600">
              <Shield className="w-4 h-4" />
              Manage Subscription
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight">ScamGuard AI</h1>
            <p className="text-xs text-muted-foreground">Powered by built-in AI agent</p>
          </div>
        </div>
        {credits && (
          <div className="text-xs text-muted-foreground bg-slate-100 px-3 py-1.5 rounded-full">
            {credits.remaining} / {credits.limit} credits left
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center">
              <Bot className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="font-semibold text-lg">Ask ScamGuard AI</h2>
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

      {/* Input Area */}
      <div className="flex-shrink-0 space-y-2">
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="rounded-xl max-h-24" />
            <button
              onClick={() => handleImageSelect(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white rounded-2xl border border-border/50 p-2">
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
              className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}