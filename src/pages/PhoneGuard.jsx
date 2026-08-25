import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Phone, Radio } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PhoneLookup from "@/pages/PhoneLookup";
import LiveCallAnalyzer from "@/pages/LiveCallAnalyzer";

export default function PhoneGuard() {
  const [params] = useSearchParams();
  const initial = params.get("tab") === "live" ? "live" : "lookup";
  const [tab, setTab] = useState(initial);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Phone className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Phone Guard</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Check unknown numbers for scam reports, or get real-time AI protection during live calls and on-screen messages.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="animate-slide-up" style={{ animationDelay: "50ms" }}>
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="lookup" className="gap-2">
            <Phone className="w-4 h-4" /> Number Lookup
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-2">
            <Radio className="w-4 h-4" /> Call Guard
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lookup" className="mt-6">
          <PhoneLookup />
        </TabsContent>
        <TabsContent value="live" className="mt-6">
          <LiveCallAnalyzer />
        </TabsContent>
      </Tabs>
    </div>
  );
}