import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Bell, Filter } from "lucide-react";
import FamilyAlertCard from "@/components/family/FamilyAlertCard";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_guardian", label: "Pending" },
  { value: "resolved", label: "Resolved" },
];
const RISK_OPTIONS = [
  { value: "all", label: "All risk" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function FamilyAlertsPanel({ seniors = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [filterMember, setFilterMember] = useState("all");

  const load = async () => {
    try {
      const data = await base44.entities.FamilyAlert.list("-created_date", 200);
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.FamilyAlert.subscribe(() => load());
    return () => unsubscribe();
  }, []);

  const memberName = (alert) => seniors.find((s) => s.id === alert.member_id)?.name || "Family member";

  const filtered = alerts.filter(
    (a) =>
      (filterStatus === "all" || a.status === filterStatus) &&
      (filterRisk === "all" || a.risk_level === filterRisk) &&
      (filterMember === "all" || a.member_id === filterMember)
  );

  const pendingCount = alerts.filter((a) => a.status === "pending_guardian").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-warning/5 border border-warning/30 text-sm">
          <Bell className="w-4 h-4 text-warning" />
          <span className="font-medium">{pendingCount} pending {pendingCount === 1 ? "alert" : "alerts"} need your response.</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <SelectChip label="Status" value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} />
        <SelectChip label="Risk" value={filterRisk} onChange={setFilterRisk} options={RISK_OPTIONS} />
        {seniors.length > 1 && (
          <SelectChip
            label="Member"
            value={filterMember}
            onChange={setFilterMember}
            options={[{ value: "all", label: "All members" }, ...seniors.map((s) => ({ value: s.id, label: s.name }))]}
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No family alerts</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            When a protected family member uses "Ask Family", their request will appear here for you to review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <FamilyAlertCard key={alert.id} alert={alert} memberName={memberName(alert)} canRespond />
          ))}
        </div>
      )}
    </div>
  );
}

function SelectChip({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs rounded-lg border border-border/50 bg-card px-2.5 py-1.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      aria-label={label}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}