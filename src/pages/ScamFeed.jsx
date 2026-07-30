import React from "react";
import { Megaphone } from "lucide-react";
import ScamFeedPanel from "@/components/community/ScamFeedPanel";

export default function ScamFeed() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Megaphone className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Scam Feed & Trends</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Community-reported scams and aggregate trends. See what's happening and help others by reporting what you've encountered.
        </p>
      </div>
      <ScamFeedPanel />
    </div>
  );
}