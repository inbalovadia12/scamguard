import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, MapPin, TrendingUp, AlertTriangle, Globe2, Calendar } from "lucide-react";
import MonthFrequencyChart from "@/components/local-scam/MonthFrequencyChart";
import ScamLocationsMap from "@/components/local-scam/ScamLocationsMap";

const RANGE_PRESETS = [
  { value: "all", label: "All Time" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "12m", label: "12 Months" },
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
];

function filterScansByRange(allScans, range) {
  if (range === "all") return allScans;
  const now = new Date();
  if (range.startsWith("q")) {
    const q = parseInt(range[1], 10) - 1;
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    return allScans.filter((s) => {
      const d = new Date(s.created_date);
      return d >= start && d <= end;
    });
  }
  const months = parseInt(range, 10);
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return allScans.filter((s) => new Date(s.created_date) >= start);
}

export default function LocalScamDashboard() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.LocalScamScan.list("-created_date", 200);
        setScans(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
            <Globe2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No scam location data yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Run a local scam intelligence scan to start populating your dashboard with monthly trends and location data.
          </p>
        </div>
      </div>
    );
  }

  const filteredScans = filterScansByRange(scans, dateRange);
  const riskCounts = { low: 0, medium: 0, high: 0 };
  filteredScans.forEach((s) => {
    if (s.risk_level) riskCounts[s.risk_level]++;
  });
  const geolocated = filteredScans.filter(
    (s) => s.latitude != null && s.longitude != null
  ).length;
  const uniqueLocations = new Set(filteredScans.map((s) => s.location_name)).size;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 flex items-center justify-center shadow-md shadow-primary/30">
            <Globe2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Local Scam Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Visualize scam frequency trends and active scam hotspots across locations.
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-2 animate-slide-up" style={{ animationDelay: "30ms" }}>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          Period
        </span>
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setDateRange(preset.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              dateRange === preset.value
                ? "bg-gradient-to-r from-violet-500 via-primary to-cyan-500 text-white shadow-md shadow-primary/20"
                : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {filteredScans.length === 0 ? (
        <div className="p-10 rounded-2xl border border-border/50 bg-card text-center space-y-3 luxury-card-hover">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">No scans in this period</p>
          <p className="text-xs text-muted-foreground">Try selecting a different date range above.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
            <SummaryCard icon={Globe2} label="Locations Scanned" value={uniqueLocations} gradient="from-violet-500 to-fuchsia-500" />
            <SummaryCard icon={TrendingUp} label="Total Scans" value={filteredScans.length} gradient="from-emerald-500 to-teal-500" />
            <SummaryCard icon={MapPin} label="Geolocated" value={geolocated} gradient="from-blue-500 to-cyan-500" />
            <SummaryCard icon={AlertTriangle} label="High Risk Areas" value={riskCounts.high} gradient="from-rose-500 to-orange-500" />
          </div>

          <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <MonthFrequencyChart scans={filteredScans} />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "150ms" }}>
            <ScamLocationsMap scans={filteredScans} />
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, gradient }) {
  return (
    <div className="p-4 rounded-2xl border border-border/50 bg-card luxury-card-hover">
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}