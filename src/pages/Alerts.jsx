import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AlertCard from "@/components/alerts/AlertCard";

export default function Alerts() {
  const [analyses, setAnalyses] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const [seniorData, analysisData] = await Promise.all([
        base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
        base44.entities.ScamAnalysis.list("-created_date", 50),
      ]);
      setSeniors(seniorData);

      const seniorUserIds = seniorData.map((s) => s.senior_user_id).filter(Boolean);
      const relevant = analysisData.filter(
        (a) => a.created_by_id === user.id || seniorUserIds.includes(a.created_by_id)
      );
      setAnalyses(relevant);
      setLoading(false);
    };
    load();
  }, []);

  const getSeniorName = (analysis) => {
    const senior = seniors.find((s) => s.senior_user_id === analysis.created_by_id);
    return senior?.name;
  };

  const filtered = tab === "all" ? analyses : analyses.filter((a) => a.guardian_status === tab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Guardian Alerts</h1>
        <p className="text-muted-foreground mt-1">Review messages checked by you and your protected family members.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="handled">Handled</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No alerts yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Alerts will appear here when you or your protected family members check suspicious messages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((analysis) => (
            <AlertCard key={analysis.id} analysis={analysis} seniorName={getSeniorName(analysis)} />
          ))}
        </div>
      )}
    </div>
  );
}