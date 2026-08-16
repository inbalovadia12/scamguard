import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, PhoneCall, Database, Activity, AlertCircle, Save, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

function Stat({ icon: Icon, label, value, tone }) {
  const toneClass =
    tone === "primary" ? "bg-primary/10 text-primary" :
    tone === "chart5" ? "bg-chart-5/10 text-chart-5" :
    tone === "success" ? "bg-success/10 text-success" :
    tone === "destructive" ? "bg-destructive/10 text-destructive" :
    "bg-muted text-muted-foreground";
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
      <div className={"w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 " + toneClass}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold font-heading leading-none">{value ?? "—"}</div>
        <div className="text-xs text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

export default function CallDirectoryTab() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [st, cfg] = await Promise.all([
        base44.functions.invoke("getCallDirectoryAdminStatus"),
        base44.functions.invoke("getCallDirectoryConfig"),
      ]);
      setStatus(st.data);
      setConfig(cfg.data?.config);
    } catch (e) {
      toast({ title: "Error loading Call Directory", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await base44.functions.invoke("regenerateCallDirectory", { triggered_by: "manual" });
      toast({
        title: "Dataset regenerated",
        description:
          "v" + (res.data?.version ?? 0) + " • " +
          (res.data?.added ?? 0) + " added / " +
          (res.data?.updated ?? 0) + " updated / " +
          (res.data?.removed ?? 0) + " removed" +
          (res.data?.has_more ? " (partial — re-run to continue)" : ""),
      });
      load();
    } catch (e) {
      toast({ title: "Regeneration failed", description: e.message, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("saveCallDirectoryConfig", {
        scam_label: config.scam_label,
        spam_label: config.spam_label,
        suspicious_label: config.suspicious_label,
        safe_label: config.safe_label,
        unknown_label: config.unknown_label,
        min_confidence: Number(config.min_confidence) || 0,
        include_safe: !!config.include_safe,
        include_verified_businesses: !!config.include_verified_businesses,
        entitled_plans: config.entitled_plans,
      });
      toast({ title: "Caller-ID config saved" });
      load();
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const labelFields = [
    { key: "scam_label", label: "SCAM label" },
    { key: "spam_label", label: "SPAM label" },
    { key: "suspicious_label", label: "SUSPICIOUS label" },
    { key: "safe_label", label: "SAFE label" },
    { key: "unknown_label", label: "UNKNOWN label (empty = no entry)" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Call Directory Dataset</h3>
            <Badge variant="outline">v{status?.latest_version ?? 0}</Badge>
            {status?.last_error && <Badge variant="destructive">Error</Badge>}
          </div>
          <Button onClick={handleRegenerate} disabled={regenerating} className="gap-2">
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerate Dataset
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Database} label="Published entries" value={status?.entry_count} tone="primary" />
          <Stat icon={Activity} label="Last sync" value={status?.latest_generated_at ? new Date(status.latest_generated_at).toLocaleString() : "—"} tone="chart5" />
          <Stat icon={RefreshCw} label="Last added" value={status?.last_added_count} tone="success" />
          <Stat icon={AlertCircle} label="Sync errors" value={status?.error_count} tone="destructive" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Updated</div>
            <div className="font-semibold">{status?.last_updated_count ?? 0}</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Removed</div>
            <div className="font-semibold">{status?.last_removed_count ?? 0}</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Triggered by</div>
            <div className="font-semibold capitalize">{status?.latest_triggered_by || "—"}</div>
          </div>
        </div>

        {status?.last_error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{status.last_error.error_message || "Last generation failed"}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Link to="/call-directory-docs" className="text-sm text-primary hover:underline flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" /> iOS integration documentation
          </Link>
          <span className="text-xs text-muted-foreground">{status?.latest_notes || ""}</span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-muted-foreground" />Recent changes</h3>
        {(!status?.recent_changes || status.recent_changes.length === 0) ? (
          <p className="text-sm text-muted-foreground py-2">No published changes yet. Regenerate the dataset to produce the first version.</p>
        ) : (
          <div className="space-y-1.5">
            {status.recent_changes.slice(0, 12).map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm border-b border-border/30 py-1.5 last:border-0">
                <span className="font-mono text-xs truncate">{c.phone_number}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={c.operation === "REMOVE" ? "destructive" : c.operation === "ADD" ? "default" : "secondary"} className="text-[10px]">{c.operation}</Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{c.label}</span>
                  <span className="text-xs text-muted-foreground">v{c.version}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {config && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
          <h3 className="font-semibold">Caller-ID Labels & Thresholds</h3>
          <p className="text-sm text-muted-foreground">Labels are configurable and used by the future iOS Call Directory Extension. Unknown numbers receive no entry by default.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {labelFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input value={config[f.key] ?? ""} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs">Min confidence (0-100)</Label>
              <Input type="number" min={0} max={100} value={config.min_confidence ?? 60} onChange={(e) => setConfig({ ...config, min_confidence: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!config.include_safe} onCheckedChange={(v) => setConfig({ ...config, include_safe: v })} />
              Publish SAFE (non-verified) numbers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!config.include_verified_businesses} onCheckedChange={(v) => setConfig({ ...config, include_verified_businesses: v })} />
              Publish verified businesses
            </label>
          </div>
          <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </Button>
        </div>
      )}
    </div>
  );
}