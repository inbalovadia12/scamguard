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

export default function GuardianDashboardPanel() {
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

  const urgentAlerts = useMemo(() => {
    return analyses
      .filter((a) => a.guardian_status === "new")
      .sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return (order[b.risk_level] || 0) - (order[a.risk_level] || 0);
      })
      .slice(0, 5)
      .map((alert) => ({
        ...alert,
        senior: seniors.find(
          (s) => s.id === alert.senior_id || (s.senior_user_id && s.senior_user_id === alert.created_by_id)
        ),
      }));
  }, [analyses, seniors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalMembers === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">No family members yet</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Add a family member in the Members tab to start monitoring their scam alerts and risk status here.
        </p>
      </div>
    );
  }

  const highestRiskCfg = highestRisk ? RISK_CONFIG[highestRisk] : null;
  const sortedStats = [...seniorStats].sort((a, b) => {
    if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
    if (a.pendingCount === 0 && b.pendingCount > 0) return 1;
    const aDate = a.lastScan ? new Date(a.lastScan.created_date).getTime() : 0;
    const bDate = b.lastScan ? new Date(b.lastScan.created_date).getTime() : 0;
    return bDate - aDate;
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up">
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
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 animate-slide-up">
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

      {/* Urgent Alerts */}
      {urgentAlerts.length > 0 && (
        <div className="space-y-3 animate-slide-up">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Urgent Alerts ({urgentAlerts.length})
          </h2>
          <div className="space-y-2">
            {urgentAlerts.map((alert) => {
              const riskCfg = RISK_CONFIG[alert.risk_level];
              const seniorName = alert.senior?.name || "Unknown member";
              return (
                <Link
                  key={alert.id}
                  to={`/alerts/${alert.id}`}
                  className={`block bg-card rounded-2xl border p-3.5 hover:shadow-md transition-all ${
                    alert.risk_level === "high" ? "border-destructive/40" : "border-border/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${riskCfg?.dot || "bg-muted-foreground"} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{seniorName}</p>
                        {riskCfg && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>
                            {riskCfg.label.replace(" Risk", "")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {alert.message_text?.slice(0, 80) || "Scam alert"}...
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(alert.created_date)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Senior Status Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 animate-slide-up">
          Family Members
        </h2>
        {sortedStats.map(({ senior, lastScan, pendingCount }, i) => (
          <div key={senior.id} style={{ animationDelay: `${100 + i * 40}ms` }}>
            <SeniorStatusCard senior={senior} lastScan={lastScan} pendingCount={pendingCount} />
          </div>
        ))}
      </div>

      {/* Quick Tips */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 animate-slide-up">
          Guardian Quick Tips
        </h2>
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3 animate-slide-up">
          {[
            { icon: ShieldCheck, title: "Agree on a safe word", desc: "Use a family safe word to verify identity if someone claims to be a relative in trouble." },
            { icon: AlertTriangle, title: "No legitimate org asks for gift cards", desc: "Remind seniors: real banks, governments, and companies never demand gift cards or wire transfers." },
            { icon: Bell, title: "Check alerts promptly", desc: "Quick action on pending alerts can prevent financial loss — review them within 24 hours." },
            { icon: Users, title: "Adjust alert preferences", desc: "Set 'high risk only' for members who scan often to avoid alert fatigue." },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <tip.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}