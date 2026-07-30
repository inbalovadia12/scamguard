import React from "react";
import { MessagesSquare } from "lucide-react";
import ConversationPanel from "@/components/scam/ConversationPanel";

export default function ConversationAnalyzer() {
  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8">
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20 flex-shrink-0">
            <MessagesSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">Conversation Analyzer</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Paste an entire chat conversation — SMS, WhatsApp, email thread, or dating app chat. AI analyzes patterns over time, not just single messages.
        </p>
      </div>
      <ConversationPanel />
    </div>
  );
}