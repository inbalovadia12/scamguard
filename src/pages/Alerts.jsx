import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Loader2, MessageCircle, ShieldCheck, Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlertCard from "@/components/alerts/AlertCard";
import FamilyAlertCard from "@/components/family/FamilyAlertCard";
import AskFamilyButton from "@/components/family/AskFamilyButton";

export default function Alerts() {
  const [view, setView] = useState("guardian");
  const [analyses, setAnalyses] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [familyAlerts, setFamilyAlerts] = useState([]);
  const [protectedBy, setProtectedBy] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const load = useCallback(async () => {
    const user = await base44.auth.me();
    const [seniorData, analysisData, familyData, memRes] = await Promise.all([
      base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
      base44.entities.ScamAnalysis.list("-created_date", 50),
      base44.entities.FamilyAlert.list("-created_date", 100),
      base44.functions.invoke("getFamilyView", {}).then((r) => r?.data || r).catch(() => ({ memberships: [] })),
    ]);
    setSeniors(seniorData);
    const memberships = memRes?.memberships || [];
    setProtectedBy(memberships.filter((m) => m.consent_given));
    setPendingInvites(memberships.filter((m) => !m.consent_given));

    const seniorUserIds = seniorData.map((s) => s.senior_user_id).filter(Boolean);
    const relevant = analysisData.filter(
      (a) => a.created_by_id === user.id || seniorUserIds.includes(a.created_by_id)
    );
    setAnalyses(relevant);
    setFamilyAlerts(familyData);

    // Guardian with pending Ask Family requests defaults to the family responses view
    const pendingForMe = familyData.filter((a) => a.guardian_id === user.id && a.status === "pending_guardian");
    const myAlerts = familyData.filter((a) => a.created_by_id === user.id);
    if (pendingForMe.length > 0 || (myAlerts.length > 0 && seniorData.length === 0)) setView("family");

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsubAlerts = base44.entities.FamilyAlert.subscribe(() => load());
    const unsubMembers = base44.entities.ProtectedSenior.subscribe(() => load());
    return () => { try { unsubAlerts(); } catch {} try { unsubMembers(); } catch {} };
  }, [load]);

  const handleAcceptInvite = async (recordId) => {
    setAccepting(recordId);
    try {
      await base44.functions.invoke("acceptFamilyInvitation", { record_id: recordId });
      await load();
    } catch {
    } finally {
      setAccepting(null);
    }
  };

  const getSeniorName = (analysis) => {
    const senior = seniors.find((s) => s.senior_user_id === analysis.created_by_id);
    return senior?.name;
  };

  const getMemberName = (alert) => {
    const senior = seniors.find((s) => s.id === alert.member_id);
    return senior?.name || "Family member";
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
        <h1 className="text-2xl font-bold tracking-tight font-heading">Alerts</h1>
        <p className="text-muted-foreground mt-1">Your scan alerts and your guardian's responses.</p>
      </div>

      {protectedBy.length > 0 && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-start gap-3 animate-fade-in">
          <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              You're protected by {protectedBy.map((s) => s.guardian_name || "your family member").join(", ")}
            </p>
            <p className="text-muted-foreground mt-0.5">
              You share their Vardin plan benefits. Your scans are shared with your guardian so they can help keep you safe.
            </p>
          </div>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3 animate-fade-in">
          <Crown className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {pendingInvites.length === 1
                ? `${pendingInvites[0].guardian_name} added you to their family`
                : `You have ${pendingInvites.length} family invitations`}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Accept to activate scam protection and share their plan benefits.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {pendingInvites.map((m) => (
                <Button
                  key={m.senior_record_id}
                  size="sm"
                  disabled={accepting === m.senior_record_id}
                  onClick={() => handleAcceptInvite(m.senior_record_id)}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                >
                  {accepting === m.senior_record_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Accept {pendingInvites.length === 1 ? "invitation" : m.guardian_name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

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
        </button>
      </div>

      {view === "family" ? (
        <FamilyResponsesView
          familyAlerts={familyAlerts}
          seniors={seniors}
          getMemberName={getMemberName}
          onResponded={load}
        />
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
                <div key={analysis.id} className="space-y-2">
                  <AlertCard analysis={analysis} seniorName={getSeniorName(analysis)} />
                  {protectedBy.length > 0 && (
                    <AskFamilyButton
                      analysisId={analysis.id}
                      analysisType="scam_analysis"
                      threatExcerpt={analysis.message_text}
                      riskLevel={analysis.risk_level || "medium"}
                      scamType={analysis.message_type || "other"}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FamilyResponsesView({ familyAlerts, seniors, getMemberName, onResponded }) {
  // Split into guardian-side (Ask Family requests from seniors I protect) and
  // member-side (my own requests with the guardian's response).
  // We can't know the user id here directly, so infer from the two sides:
  // guardian-side alerts have guardian_id matching one of my seniors' guardian_id (me).
  const mySeniorIds = seniors.map((s) => s.id);
  const guardianAlerts = familyAlerts.filter((a) => mySeniorIds.includes(a.member_id));
  const memberAlerts = familyAlerts.filter((a) => !mySeniorIds.includes(a.member_id));

  const pending = guardianAlerts.filter((a) => a.status === "pending_guardian").length;

  if (guardianAlerts.length === 0 && memberAlerts.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">No family responses yet</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          When someone uses "Ask Family" on a scan, their request and your response will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {guardianAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <MessageCircle className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Ask Family requests
            </h2>
            {pending > 0 && (
              <span className="text-xs font-semibold bg-warning/20 text-warning rounded-full px-2 py-0.5">
                {pending} waiting
              </span>
            )}
          </div>
          {guardianAlerts.map((a) => (
            <FamilyAlertCard
              key={a.id}
              alert={a}
              memberName={getMemberName(a)}
              canRespond={a.status === "pending_guardian"}
              onResponded={onResponded}
            />
          ))}
        </div>
      )}

      {memberAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Your requests
            </h2>
          </div>
          {memberAlerts.map((a) => (
            <FamilyAlertCard key={a.id} alert={a} memberName="You" canRespond={false} />
          ))}
        </div>
      )}
    </div>
  );
}