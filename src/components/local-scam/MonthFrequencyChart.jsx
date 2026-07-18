import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
    <div className="p-5 rounded-2xl border border-border/50 bg-card">
      <h3 className="font-semibold text-sm mb-4">Scam Frequency by Month</h3>
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
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Scams peaking" />
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