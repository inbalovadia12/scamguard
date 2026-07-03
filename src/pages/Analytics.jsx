import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2, BarChart3, TrendingUp, AlertTriangle, Shield, Download,
  Lock, MessageSquare, Mail, Briefcase, ShoppingCart, Heart, Landmark,
  HelpCircle, Crown,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getCreditStatus } from "@/lib/credits";

const RISK_COLORS = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const MESSAGE_TYPE_ICONS = {
  sms: MessageSquare, email: Mail, job_offer: Briefcase, marketplace: ShoppingCart,
  romance: Heart, bank_government: Landmark, tech_support: HelpCircle, other: Shield,
};

export default function Analytics() {
  const [analyses, setAnalyses] = useState([]);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const creditStatus = await getCreditStatus();
      setCredits(creditStatus);

      if (!creditStatus.isElite) {
        setLoading(false);
        return;
      }

      const data = await base44.entities.ScamAnalysis.list("-created_date", 200);
      setAnalyses(data);
      setLoading(false);
    };
    load();
  }, []);

  const exportCSV = () => {
    const headers = ["Date", "Type", "Risk Level", "Risk Score", "Tactics", "Message Preview"];
    const rows = analyses.map((a) => [
      new Date(a.created_date).toLocaleString(),
      a.message_type || "other",
      a.risk_level || "unknown",
      a.risk_score || 0,
      (a.tactics_detected || []).join("; "),
      (a.message_text || "").substring(0, 100).replace(/"/g, "'"),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scamguard-analyses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!credits?.isElite) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Elite Feature</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The Advanced Analytics Dashboard is an Elite plan feature. Upgrade to access scam trend
            analysis, risk distribution charts, and CSV exports.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              <Crown className="w-4 h-4" />
              Upgrade to Elite
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Compute analytics
  const total = analyses.length;
  const riskCounts = { low: 0, medium: 0, high: 0 };
  const typeCounts = {};
  const tacticCounts = {};
  const highRisk = analyses.filter((a) => a.risk_level === "high");

  analyses.forEach((a) => {
    if (a.risk_level) riskCounts[a.risk_level]++;
    if (a.message_type) typeCounts[a.message_type] = (typeCounts[a.message_type] || 0) + 1;
    (a.tactics_detected || []).forEach((t) => {
      tacticCounts[t] = (tacticCounts[t] || 0) + 1;
    });
  });

  const riskData = [
    { name: "Low Risk", value: riskCounts.low, color: RISK_COLORS.low },
    { name: "Medium Risk", value: riskCounts.medium, color: RISK_COLORS.medium },
    { name: "High Risk", value: riskCounts.high, color: RISK_COLORS.high },
  ].filter((d) => d.value > 0);

  const typeData = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const tacticData = Object.entries(tacticCounts)
    .map(([tactic, count]) => ({ tactic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (total === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No data yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Start analyzing suspicious messages to see your scam analytics, trends, and insights here.
          </p>
          <Link to="/">
            <Button className="bg-gradient-to-r from-primary to-primary/80">
              Check a Message
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your scam detection insights and trends.</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Shield} label="Total Analyses" value={total} color="text-primary" />
        <SummaryCard icon={AlertTriangle} label="High Risk" value={riskCounts.high} color="text-red-500" />
        <SummaryCard icon={TrendingUp} label="Avg Risk Score" value={Math.round(analyses.reduce((s, a) => s + (a.risk_score || 0), 0) / total)} color="text-amber-500" />
        <SummaryCard icon={BarChart3} label="Types Detected" value={Object.keys(typeCounts).length} color="text-emerald-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Risk Distribution */}
        {riskData.length > 0 && (
          <div className="p-5 rounded-2xl border border-border/50 bg-card">
            <h3 className="font-semibold text-sm mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {riskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Message Types */}
        {typeData.length > 0 && (
          <div className="p-5 rounded-2xl border border-border/50 bg-card">
            <h3 className="font-semibold text-sm mb-4">Scam Types Encountered</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="type" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Tactics */}
      {tacticData.length > 0 && (
        <div className="p-5 rounded-2xl border border-border/50 bg-card">
          <h3 className="font-semibold text-sm mb-4">Top Manipulation Tactics</h3>
          <div className="space-y-2">
            {tacticData.map((tactic, i) => {
              const pct = Math.round((tactic.count / total) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-40 flex-shrink-0">{tactic.tactic}</span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{tactic.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent High-Risk */}
      {highRisk.length > 0 && (
        <div className="p-5 rounded-2xl border border-border/50 bg-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Recent High-Risk Messages
          </h3>
          <div className="space-y-2">
            {highRisk.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                {a.message_type && MESSAGE_TYPE_ICONS[a.message_type] && (
                  React.createElement(MESSAGE_TYPE_ICONS[a.message_type], { className: "w-4 h-4 text-muted-foreground flex-shrink-0" })
                )}
                <p className="text-sm flex-1 truncate">{a.message_text}</p>
                <span className="text-xs font-bold text-red-500 flex-shrink-0">{a.risk_score}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="p-4 rounded-2xl border border-border/50 bg-card">
      <Icon className={`w-5 h-5 mb-2 ${color}`} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}