import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Loader2, BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle,
  MapPin, Globe2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell,
} from "recharts";

const SCAM_TYPE_LABELS = {
  phishing_email: "Phishing Email",
  smishing: "Text Scam",
  romance: "Romance Scam",
  crypto_investment: "Crypto/Investment",
  marketplace: "Marketplace Scam",
  tech_support: "Tech Support Scam",
  fake_job: "Fake Job Offer",
  delivery: "Delivery Scam",
  lottery_prize: "Lottery/Prize",
  government_impersonation: "Gov Impersonation",
  bank_impersonation: "Bank Impersonation",
  other: "Other",
};

const TYPE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-1))",
  "hsl(var(--warning))", "hsl(var(--success))",
];

export default function ScamTrendsPanel() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const [reports, stories] = await Promise.all([
          base44.entities.ScamReport.list("-created_date", 500),
          base44.entities.CommunityStory.list("-created_date", 500),
        ]);
        const combined = [
          ...reports.map((r) => ({ scam_type: r.scam_type, country: r.country, created_date: r.created_date })),
          ...stories.map((s) => ({ scam_type: s.scam_type, country: s.country, created_date: s.created_date })),
        ];
        setRecords(combined);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const countries = useMemo(() => {
    const set = new Set(records.map((r) => r.country).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    if (country === "all") return records;
    return records.filter((r) => r.country === country);
  }, [records, country]);

  const typeData = useMemo(() => {
    const counts = {};
    filtered.forEach((r) => {
      if (r.scam_type) {
        const label = SCAM_TYPE_LABELS[r.scam_type] || r.scam_type;
        counts[label] = (counts[label] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  const trendData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en", { month: "short" }),
        count: 0,
      });
    }
    const monthMap = {};
    months.forEach((m) => { monthMap[m.key] = m; });
    filtered.forEach((r) => {
      if (!r.created_date) return;
      const d = new Date(r.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthMap[key]) monthMap[key].count++;
    });
    return months;
  }, [filtered]);

  const trendDirection = useMemo(() => {
    if (trendData.length < 2) return { dir: "stable", pct: 0, last: 0 };
    const last = trendData[trendData.length - 1].count;
    const prev = trendData[trendData.length - 2].count;
    if (prev === 0) return { dir: last > 0 ? "rising" : "stable", pct: last > 0 ? 100 : 0, last };
    const pct = Math.round(((last - prev) / prev) * 100);
    if (pct > 10) return { dir: "rising", pct, last };
    if (pct < -10) return { dir: "falling", pct, last };
    return { dir: "stable", pct, last };
  }, [trendData]);

  const topType = typeData[0];
  const totalReports = filtered.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">No scam data collected yet</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Once scam reports and community stories are submitted, trends will appear here.
        </p>
      </div>
    );
  }

  const TrendIcon = trendDirection.dir === "rising" ? TrendingUp : trendDirection.dir === "falling" ? TrendingDown : Minus;
  const trendColor = trendDirection.dir === "rising" ? "text-destructive" : trendDirection.dir === "falling" ? "text-success" : "text-muted-foreground";
  const trendBg = trendDirection.dir === "rising" ? "bg-destructive/10" : trendDirection.dir === "falling" ? "bg-success/10" : "bg-muted";
  const trendLabel = trendDirection.dir === "rising" ? "Rising" : trendDirection.dir === "falling" ? "Falling" : "Stable";

  return (
    <div className="space-y-5">
      {/* Country Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> Area
        </span>
        <button
          onClick={() => setCountry("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            country === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
          }`}
        >
          All Areas
        </button>
        {countries.map((c) => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              country === c
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 rounded-2xl border border-border/50 bg-card text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
            <MapPin className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">No reports in this area yet</p>
          <p className="text-xs text-muted-foreground">Try selecting "All Areas" or a different country.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-border/50 bg-card">
              <BarChart3 className="w-5 h-5 mb-2 text-primary" />
              <div className="text-2xl font-bold font-heading">{totalReports}</div>
              <div className="text-xs text-muted-foreground">Total Reports</div>
            </div>
            <div className="p-4 rounded-2xl border border-border/50 bg-card">
              <AlertTriangle className="w-5 h-5 mb-2 text-warning" />
              <div className="text-lg font-bold font-heading truncate">{topType ? topType.type : "—"}</div>
              <div className="text-xs text-muted-foreground">Most Common Type</div>
            </div>
            <div className="p-4 rounded-2xl border border-border/50 bg-card col-span-2 md:col-span-1">
              <div className={`w-9 h-9 rounded-lg ${trendBg} flex items-center justify-center mb-2`}>
                <TrendIcon className={`w-5 h-5 ${trendColor}`} />
              </div>
              <div className="text-2xl font-bold font-heading">
                {trendDirection.dir === "stable" && trendDirection.last === 0 ? "—" : `${trendDirection.pct > 0 ? "+" : ""}${trendDirection.pct}%`}
              </div>
              <div className="text-xs text-muted-foreground">{trendLabel} this month</div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="p-5 rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm">Monthly Trend</h3>
                <p className="text-xs text-muted-foreground">Scam reports over the last 6 months</p>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${trendBg} ${trendColor}`}>
                <TrendIcon className="w-3.5 h-3.5" />
                {trendLabel}
                {trendDirection.pct !== 0 && trendDirection.last > 0 && (
                  <span className="opacity-75">({trendDirection.pct > 0 ? "+" : ""}{trendDirection.pct}%)</span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#trendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Common Scam Types Chart */}
          <div className="p-5 rounded-2xl border border-border/50 bg-card">
            <h3 className="font-semibold text-sm mb-4">Most Common Scam Types</h3>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, typeData.length * 36)}>
                <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="type" type="category" width={120} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No scam type data available for this area.</p>
            )}
          </div>

          {country === "all" && countries.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Globe2 className="w-3.5 h-3.5" />
              Showing data across {countries.length} {countries.length === 1 ? "area" : "areas"}.
            </div>
          )}
        </>
      )}
    </div>
  );
}