import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2, History, ShieldCheck, AlertTriangle, ShieldAlert,
  ThumbsDown, TrendingUp, Scan, BarChart3, Users, Bell,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";

const RISK_CONFIG = {
  low: { color: "hsl(var(--success))", text: "text-success", bg: "bg-success/10", label: "Low" },
  medium: { color: "hsl(var(--warning))", text: "text-warning", bg: "bg-warning/10", label: "Medium" },
  high: { color: "hsl(var(--destructive))", text: "text-destructive", bg: "bg-destructive/10", label: "High" },
};

const TYPE_LABELS = {
  sms: "Text", email: "Email", url: "URL", phone: "Phone", marketplace: "Marketplace",
  romance: "Romance", crypto_investment: "Crypto", tech_support: "Tech Support",
  bank_government: "Bank/Gov", delivery: "Delivery", job_offer: "Job Offer",
  lottery_prize: "Lottery", charity: "Charity", other: "Other",
};

function timeAgo(date) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function TrustHistory() {
  const [allScans, setAllScans] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("mine");

  useEffect(() => {
    const load = async () => {
      try {
        const user = await base44.auth.me();
        const [scanData, seniorData] = await Promise.all([
          base44.entities.ScamAnalysis.list("-created_date", 100),
          base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
        ]);
        setAllScans(scanData);
        setSeniors(seniorData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Family scans = scans created by one of the guardian's protected members
  const familyScans = useMemo(() => {
    const seniorUserIds = seniors.map((s) => s.senior_user_id).filter(Boolean);
    return allScans.filter((s) => seniorUserIds.includes(s.created_by_id));
  }, [allScans, seniors]);

  const isFamily = view === "family" && seniors.length > 0;
  const scans = isFamily ? familyScans : allScans.filter((s) => s.created_by_id === (allScans[0] && true) ? s.created_by_id : s.created_by_id);

  // For "mine", show scans created by the current user only
  const mineScans = useMemo(() => {
    return allScans.filter((s) => !seniors.map((x) => x.senior_user_id).includes(s.created_by_id));
  }, [allScans, seniors]);

  const activeScans = isFamily ? familyScans : mineScans;

  const memberName = (scan) => {
    const senior = seniors.find((s) => s.senior_user_id === scan.created_by_id);
    return senior?.name;
  };

  const stats = useMemo(() => {
    const total = activeScans.length;
    const byRisk = { low: 0, medium: 0, high: 0 };
    let falsePositives = 0;
    const byType = {};
    activeScans.forEach((s) => {
      if (s.risk_level && byRisk[s.risk_level] !== undefined) byRisk[s.risk_level]++;
      if (s.is_false_positive) falsePositives++;
      const type = s.message_type ? (TYPE_LABELS[s.message_type] || s.message_type) : "Unknown";
      byType[type] = (byType[type] || 0) + 1;
    });
    const pending = activeScans.filter((s) => s.guardian_status === "new").length;
    const riskData = [
      { name: "Low", value: byRisk.low, fill: RISK_CONFIG.low.color },
      { name: "Medium", value: byRisk.medium, fill: RISK_CONFIG.medium.color },
      { name: "High", value: byRisk.high, fill: RISK_CONFIG.high.color },
    ].filter((d) => d.value > 0);
    const typeData = Object.entries(byType).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    return { total, byRisk, falsePositives, riskData, typeData, topType: typeData[0]?.type, pending };
  }, [activeScans]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSeniors = seniors.length > 0;

  if (activeScans.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Header />
        {hasSeniors && <ViewToggle view={view} setView={setView} />}
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Scan className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{isFamily ? "No family scans yet" : "No scans yet"}</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {isFamily
              ? "Scans run by your protected family members will show up here with their risk patterns."
              : "Scan your first suspicious message, URL, or image to start building your trust history."}
          </p>
          <Link to="/universal-scan">
            <Button className="bg-gradient-to-r from-primary to-primary/80 gap-2">
              <Scan className="w-4 h-4" /> Start a Scan
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <Header />
      {hasSeniors && <ViewToggle view={view} setView={setView} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "40ms" }}>
        <SummaryCard icon={BarChart3} value={stats.total} label={isFamily ? "Family Scans" : "Total Scans"} />
        <SummaryCard icon={ShieldAlert} value={stats.byRisk.high} label="High Risk" tone="destructive" />
        <SummaryCard icon={TrendingUp} value={stats.topType || "—"} label="Most Common" />
        {isFamily ? (
          <SummaryCard icon={Bell} value={stats.pending} label="Pending Actions" tone={stats.pending > 0 ? "warning" : undefined} />
        ) : (
          <SummaryCard icon={ThumbsDown} value={stats.falsePositives} label="False Positives" />
        )}
      </div>

      {/* Charts */}
      <div className="grid sm:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "60ms" }}>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-4">Risk Distribution</h3>
          {stats.riskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={stats.riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                  {stats.riskData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No data</p>
          )}
          <div className="flex justify-center gap-3 mt-2">
            {stats.riskData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-4">Recurring Scam Types</h3>
          {stats.typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.typeData} layout="vertical" margin={{ left: 10, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="type" type="category" width={70} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No data</p>
          )}
        </div>
      </div>

      {/* Scan List */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Scans</h2>
        {activeScans.map((scan) => {
          const cfg = RISK_CONFIG[scan.risk_level] || RISK_CONFIG.low;
          const RiskIcon = scan.risk_level === "high" ? ShieldAlert : scan.risk_level === "medium" ? AlertTriangle : ShieldCheck;
          const mName = memberName(scan);
          return (
            <Link key={scan.id} to="/alerts" className="block bg-card rounded-2xl border border-border/50 p-4 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <RiskIcon className={`w-4 h-4 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label} Risk</span>
                    {scan.risk_score != null && <span className="text-xs text-muted-foreground">· {scan.risk_score}/100</span>}
                    {isFamily && mName && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium inline-flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" /> {mName}
                      </span>
                    )}
                    {scan.is_false_positive && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                        <ThumbsDown className="w-2.5 h-2.5" /> Legitimate
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(scan.created_date)}</span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1 line-clamp-2">{scan.message_text}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        <Link to="/universal-scan">
          <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
            <Scan className="w-4 h-4" /> New Scan
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
          <History className="w-5 h-5 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Trust History</h1>
      </div>
      <p className="text-sm text-muted-foreground">Your scan history and recurring scam patterns over time.</p>
    </div>
  );
}

function ViewToggle({ view, setView }) {
  return (
    <div className="flex gap-1 p-1 bg-card rounded-2xl border border-border/50 w-fit animate-slide-up">
      <button onClick={() => setView("mine")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
        My Scans
      </button>
      <button onClick={() => setView("family")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${view === "family" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
        <Users className="w-3.5 h-3.5" /> Family
      </button>
    </div>
  );
}

function SummaryCard({ icon: Icon, value, label, tone }) {
  const toneClass = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary";
  return (
    <div className="p-4 rounded-2xl border border-border/50 bg-card">
      <Icon className={`w-4 h-4 mb-1.5 ${toneClass}`} />
      <div className={`text-xl font-bold font-heading ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}