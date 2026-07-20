import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { TrendingUp } from "lucide-react";

const BAR_COLORS = [
  "#8b5cf6", "#a855f7", "#3b82f6", "#06b6d4",
  "#10b981", "#14b8a6", "#eab308", "#f97316",
  "#ef4444", "#ec4899", "#6366f1", "#0ea5e9",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseMonths);
  if (typeof value === "number") {
    if (value >= 1 && value <= 12) return [value - 1];
    return [];
  }
  const str = String(value).trim().toLowerCase();
  if (!str) return [];
  const fullMatch = MONTHS.findIndex((m) => str === m.toLowerCase());
  if (fullMatch >= 0) return [fullMatch];
  const abbrMatch = MONTHS.findIndex((m) => str === m.toLowerCase().slice(0, 3));
  if (abbrMatch >= 0) return [abbrMatch];
  const num = parseInt(str, 10);
  if (num >= 1 && num <= 12) return [num - 1];
  return [];
}

export function buildMonthData(scans) {
  const counts = new Array(12).fill(0);
  scans.forEach((scan) => {
    let details = [];
    try {
      details =
        typeof scan.scam_details === "string"
          ? JSON.parse(scan.scam_details)
          : scan.scam_details || [];
    } catch {
      details = [];
    }
    if (Array.isArray(details)) {
      details.forEach((d) => {
        parseMonths(d.peak_months).forEach((m) => {
          counts[m]++;
        });
      });
    }
  });
  return MONTHS.map((m, i) => ({ month: m, count: counts[i] }));
}

export default function MonthFrequencyChart({ scans }) {
  const data = useMemo(() => buildMonthData(scans), [scans]);
  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="p-5 rounded-2xl border border-border/50 bg-card luxury-card-hover">
      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
        </div>
        Scam Frequency by Month
      </h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "0.75rem",
              }}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(262 83% 65%)" />
                <stop offset="100%" stopColor="hsl(172 66% 35%)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Scams peaking">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          No seasonal data available yet from your scans.
        </div>
      )}
    </div>
  );
}