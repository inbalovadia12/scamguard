import React, { useState, useEffect, useMemo } from "react";
import { Megaphone, Plus, Search, TrendingUp, AlertTriangle, Loader2, Filter, ShieldOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScamReportCard, { SCAM_TYPE_META } from "@/components/scam/ScamReportCard";
import ReportScamDialog from "@/components/scam/ReportScamDialog";

export default function ScamFeed() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await base44.entities.ScamReport.filter({ status: "active" }, "-created_date", 100);
      setReports(data);
    } catch (e) {
      setError(e.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (report) => {
    setVerifyingId(report.id);
    try {
      const newCount = (report.verified_count || 0) + 1;
      await base44.entities.ScamReport.update(report.id, { verified_count: newCount });
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, verified_count: newCount } : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingId(null);
    }
  };

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filterType !== "all" && r.scam_type !== filterType) return false;
      if (filterRisk !== "all" && r.risk_level !== filterRisk) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.title?.toLowerCase().includes(q) && !r.summary?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reports, filterType, filterRisk, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = reports.filter((r) => new Date(r.created_date).getTime() > weekAgo).length;
    const typeCounts = {};
    reports.forEach((r) => { typeCounts[r.scam_type] = (typeCounts[r.scam_type] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: reports.length,
      thisWeek,
      topType: topType ? SCAM_TYPE_META[topType[0]]?.label : "—",
    };
  }, [reports]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-slide-up">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <Megaphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-heading">Community Scam Feed</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Real-world scams reported by the community. See what's trending and help others by sharing what you've encountered.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Report a Scam</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <StatCard icon={Megaphone} label="Total Reports" value={stats.total} />
        <StatCard icon={TrendingUp} label="This Week" value={stats.thisWeek} />
        <StatCard icon={AlertTriangle} label="Top Type" value={stats.topType} small />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scams..."
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44"><Filter className="w-3.5 h-3.5 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(SCAM_TYPE_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRisk} onValueChange={setFilterRisk}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Loading community reports...</p>
        </div>
      ) : error ? (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadReports}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
            <ShieldOff className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {reports.length === 0 ? "No scams reported yet. Be the first to help the community!" : "No reports match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <ScamReportCard
              key={report.id}
              report={report}
              onVerify={() => handleVerify(report)}
              verifying={verifyingId === report.id}
            />
          ))}
        </div>
      )}

      <ReportScamDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmitted={loadReports} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, small }) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={`font-bold font-heading text-primary ${small ? "text-sm leading-tight" : "text-2xl"}`}>{value}</p>
    </div>
  );
}