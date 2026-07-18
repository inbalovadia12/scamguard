import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, MapPin, TrendingUp, AlertTriangle, Globe2 } from "lucide-react";
import MonthFrequencyChart from "@/components/local-scam/MonthFrequencyChart";
import ScamLocationsMap from "@/components/local-scam/ScamLocationsMap";

export default function LocalScamDashboard() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

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
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
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

  const riskCounts = { low: 0, medium: 0, high: 0 };
  scans.forEach((s) => {
    if (s.risk_level) riskCounts[s.risk_level]++;
  });
  const geolocated = scans.filter(
    (s) => s.latitude != null && s.longitude != null
  ).length;
  const uniqueLocations = new Set(scans.map((s) => s.location_name)).size;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold tracking-tight font-heading">Local Scam Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visualize scam frequency trends and active scam hotspots across locations.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <SummaryCard icon={Globe2} label="Locations Scanned" value={uniqueLocations} color="text-primary" />
        <SummaryCard icon={TrendingUp} label="Total Scans" value={scans.length} color="text-success" />
        <SummaryCard icon={MapPin} label="Geolocated" value={geolocated} color="text-muted-foreground" />
        <SummaryCard icon={AlertTriangle} label="High Risk Areas" value={riskCounts.high} color="text-destructive" />
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <MonthFrequencyChart scans={scans} />
      </div>
      <div className="animate-slide-up" style={{ animationDelay: "150ms" }}>
        <ScamLocationsMap scans={scans} />
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="p-4 rounded-2xl border border-border/50 bg-card">
      <Icon className={`w-5 h-5 mb-2 ${color}`} />
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}