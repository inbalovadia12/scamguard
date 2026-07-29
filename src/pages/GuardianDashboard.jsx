import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2, ShieldCheck, ShieldAlert, AlertTriangle, Bell,
  Clock, ChevronRight, Users, Activity,
} from "lucide-react";

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", dot: "bg-success", label: "Low Risk" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", dot: "bg-warning", label: "Medium Risk" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", dot: "bg-destructive", label: "High Risk" },
};

function timeAgo(date) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function SeniorAvatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm shadow-sm">
      {initials}
    </div>
  );
}

function SeniorStatusCard({ senior, lastScan, pendingCount }) {
  const isActive = senior.consent_given && senior.senior_user_id;
  const risk = lastScan?.risk_level;
  const riskCfg = risk ? RISK_CONFIG[risk] : null;
  const needsAttention = pendingCount > 0;

  return (
    <Link
      to="/alerts"
      className={`block bg-card rounded-2xl border p-5 animate-slide-up hover:shadow-md transition-all ${
        needsAttention ? "border-destructive/40" : "border-border/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <SeniorAvatar name={senior.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate">{senior.name}</h3>
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3" /> Protected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                )}
              </div>
              {lastScan ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Last scan: {timeAgo(lastScan.created_date)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No scans yet</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {riskCfg ? (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${riskCfg.dot}`} />
                {riskCfg.label}
                {lastScan.risk_score != null && <span className="opacity-70">· {lastScan.risk_score}/100</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                <Activity className="w-3 h-3" /> No risk data
              </span>
            )}
            {needsAttention && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                <Bell className="w-3 h-3" />
                {pendingCount} pending {pendingCount === 1 ? "alert" : "alerts"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function GuardianDashboard() {
  const [seniors, setSeniors] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await base44.auth.me();
        const [seniorData, analysisData] = await Promise.all([
          base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
          base44.entities.ScamAnalysis.list("-created_date", 200),
        ]);
        setSeniors(seniorData);
        setAnalyses(analysisData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const seniorStats = useMemo(() => {
    return seniors.map((senior) => {
      const seniorScans = analyses.filter(
        (a) =>
          a.senior_id === senior.id ||
          (senior.senior_user_id && a.created_by_id === senior.senior_user_id)
      );
      const lastScan = seniorScans[0] || null;
      const pendingCount = seniorScans.filter((a) => a.guardian_status === "new").length;
      return { senior, lastScan, pendingCount };
    });
  }, [seniors, analyses]);

  const totalPending = seniorStats.reduce((s, x) => s + x.pendingCount, 0);
  const totalMembers = seniors.length;
  const activeMembers = seniors.filter((s) => s.consent_given && s.senior_user_id).length;
  const highestRisk = useMemo(() => {
    const order = { high: 3, medium: 2, low: 1 };
    let highest = null;
    seniorStats.forEach(({ lastScan }) => {
      if (lastScan?.risk_level && (!highest || (order[lastScan.risk_level] || 0) > (order[highest] || 0))) {
        highest = lastScan.risk_level;
      }
    });
    return highest;
  }, [seniorStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalMembers === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Guardian Dashboard</h1>
          <p className="text-muted-foreground mt-1">At-a-glance status for all your protected family members.</p>
        </div>
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No family members yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add a family member to start monitoring their scam alerts and risk status in one place.
          </p>
          <Link to="/family">
            <Button className="bg-gradient-to-r from-primary to-primary/80 gap-2">
              <Users className="w-4 h-4" /> Go to Family
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const highestRiskCfg = highestRisk ? RISK_CONFIG[highestRisk] : null;
  // Sort: members needing attention first, then by most recent scan
  const sortedStats = [...seniorStats].sort((a, b) => {
    if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
    if (a.pendingCount === 0 && b.pendingCount > 0) return 1;
    const aDate = a.lastScan ? new Date(a.lastScan.created_date).getTime() : 0;
    const bDate = b.lastScan ? new Date(b.lastScan.created_date).getTime() : 0;
    return bDate - aDate;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Guardian Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          At-a-glance status for all {totalMembers} {totalMembers === 1 ? "family member" : "family members"} you protect.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "40ms" }}>
        <div className="p-4 rounded-2xl border border-border/50 bg-card">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Members</span>
          </div>
          <div className="text-xl font-bold font-heading">
            {activeMembers}<span className="text-sm text-muted-foreground font-normal"> / {totalMembers}</span>
          </div>
          <div className="text-xs text-muted-foreground">{activeMembers === totalMembers ? "All active" : `${totalMembers - activeMembers} pending`}</div>
        </div>
        <div className={`p-4 rounded-2xl border bg-card ${totalPending > 0 ? "border-destructive/40" : "border-border/50"}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <Bell className={`w-4 h-4 ${totalPending > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">Pending Alerts</span>
          </div>
          <div className={`text-xl font-bold font-heading ${totalPending > 0 ? "text-destructive" : ""}`}>
            {totalPending}
          </div>
          <div className="text-xs text-muted-foreground">{totalPending > 0 ? "Needs attention" : "All clear"}</div>
        </div>
        <div className="p-4 rounded-2xl border border-border/50 bg-card">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className={`w-4 h-4 ${highestRiskCfg ? highestRiskCfg.color : "text-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">Highest Risk</span>
          </div>
          <div className={`text-xl font-bold font-heading ${highestRiskCfg ? highestRiskCfg.color : "text-muted-foreground"}`}>
            {highestRiskCfg ? highestRiskCfg.label.replace(" Risk", "") : "None"}
          </div>
          <div className="text-xs text-muted-foreground">{highestRiskCfg ? "Across all members" : "No scans yet"}</div>
        </div>
      </div>

      {/* Attention Banner */}
      {totalPending > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 animate-slide-up" style={{ animationDelay: "60ms" }}>
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{totalPending} {totalPending === 1 ? "alert needs" : "alerts need"} your attention.</p>
            <p className="text-xs text-muted-foreground">Review them to keep your family safe.</p>
          </div>
          <Link to="/alerts">
            <Button size="sm" variant="outline" className="gap-1.5">
              Review <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Senior Status Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 animate-slide-up" style={{ animationDelay: "80ms" }}>
          Family Members
        </h2>
        {sortedStats.map(({ senior, lastScan, pendingCount }, i) => (
          <div key={senior.id} style={{ animationDelay: `${100 + i * 40}ms` }}>
            <SeniorStatusCard senior={senior} lastScan={lastScan} pendingCount={pendingCount} />
          </div>
        ))}
      </div>

      {/* Manage link */}
      <div className="flex justify-center pt-2">
        <Link to="/family">
          <Button variant="outline" className="gap-2">
            <Users className="w-4 h-4" /> Manage Family Members
          </Button>
        </Link>
      </div>
    </div>
  );
}