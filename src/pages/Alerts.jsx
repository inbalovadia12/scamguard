import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Loader2, MessageCircle } from "lucide-react";
import AlertCard from "@/components/alerts/AlertCard";
import FamilyAlertCard from "@/components/family/FamilyAlertCard";

export default function Alerts() {
  const [view, setView] = useState("guardian");
  const [analyses, setAnalyses] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [familyAlerts, setFamilyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const [seniorData, analysisData, familyData] = await Promise.all([
        base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
        base44.entities.ScamAnalysis.list("-created_date", 50),
        base44.entities.FamilyAlert.list("-created_date", 100),
      ]);
      setSeniors(seniorData);

      const seniorUserIds = seniorData.map((s) => s.senior_user_id).filter(Boolean);
      const relevant = analysisData.filter(
        (a) => a.created_by_id === user.id || seniorUserIds.includes(a.created_by_id)
      );
      setAnalyses(relevant);

      // Member's own Ask Family requests (with guardian responses)
      const myAlerts = familyData.filter((a) => a.created_by_id === user.id);
      setFamilyAlerts(myAlerts);

      // Members (not guardians) default to the family responses view
      if (myAlerts.length > 0 && seniorData.length === 0) setView("family");

      setLoading(false);
    };
    load();
  }, []);

  const getSeniorName = (analysis) => {
    const senior = seniors.find((s) => s.senior_user_id === analysis.created_by_id);
    return senior?.name;
  };

  const filtered = tab === "all" ? analyses : analyses.filter((a) => a.guardian_status === tab);
  const myFamilyCount = familyAlerts.length;

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
        <h1 className="text-2xl font-bold tracking-tight font-heading">Alerts</h1>
        <p className="text-muted-foreground mt-1">Your scan alerts and your guardian's responses.</p>
      </div>

      <div className="flex gap-1 p-1 bg-card rounded-2xl border border-border/50 w-fit">
        <button
          onClick={() => setView("guardian")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === "guardian" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Scan Alerts
        </button>
        <button
          onClick={() => setView("family")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${view === "family" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Family Responses
          {myFamilyCount > 0 && <span className="text-xs px-1.5 rounded-full bg-primary-foreground/20">{myFamilyCount}</span>}
        </button>
      </div>

      {view === "family" ? (
        myFamilyCount === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">No family responses yet</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              When you use "Ask Family" on a scan, your guardian's response will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {familyAlerts.map((a) => (
              <FamilyAlertCard key={a.id} alert={a} memberName="You" canRespond={false} />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex gap-1 flex-wrap">
            {["all", "new", "reviewed", "handled"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${tab === t ? "bg-card border border-border/50" : "text-muted-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
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
        </>
      )}
    </div>
  );
}