import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { PhoneCall, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Copy, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const VERDICT_META = {
  safe: { label: "Safe", icon: ShieldCheck, className: "text-success" },
  suspicious: { label: "Suspicious", icon: AlertTriangle, className: "text-warning" },
  scam: { label: "Scam", icon: ShieldAlert, className: "text-destructive" },
};

export default function CallGuard() {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await base44.functions.invoke("getCallGuardDashboard", {});
      setStatus(response.data || null);
    } catch (error) {
      setStatus({ connected: false, error: error.message || "Unable to load Call Guard status." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const appBaseUrl = "https://vardin.base44.app";
  const webhookUrl = `${appBaseUrl}${status?.webhook_endpoint || "/api/functions/receiveCallGuardReport"}`;

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast({ title: "Webhook URL copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy URL", variant: "destructive" });
    }
  };

  if (!loading && status?.under_construction) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <PhoneCall className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-heading">Call Guard</h1>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/20 tracking-wider uppercase">Under Construction</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">AI-powered call protection is currently in development.</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold font-heading">Call Guard isn't available yet</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">We're still finishing this feature. When it launches, Vardin will help identify suspicious calls before you answer them.</p>
          </div>
          <p className="text-xs text-muted-foreground">No call data or setup information is shown on this page.</p>
        </div>
      </div>
    );
  }

  const total = status?.total_reports || 0;
  const processed = status?.processed_reports || 0;
  const pending = status?.pending_reports || 0;
  const counts = status?.verdict_counts || { safe: 0, suspicious: 0, scam: 0 };
  const reports = status?.reports || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <PhoneCall className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-heading">Call Guard</h1>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border tracking-wider uppercase ${status?.connected ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
              {loading ? "Checking" : status?.connected ? "Connected" : "Needs attention"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Vardin answers configured calls through your voice provider, collects the caller's reason and relevant details, then runs the completed conversation through Vardin's scam analysis.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadStatus(true)} disabled={refreshing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {typeof status?.total_reports === "number" ? (
        <div className="grid sm:grid-cols-4 gap-3">
          <StatCard label="Calls received" value={total} icon={PhoneCall} />
          <StatCard label="Processed" value={processed} icon={CheckCircle2} tone="success" />
          <StatCard label="Pending" value={pending} icon={Clock3} tone={pending ? "warning" : "success"} />
          <StatCard label="Scam verdicts" value={counts.scam || 0} icon={ShieldAlert} tone="danger" />
        </div>
      ) : (
        <div className="rounded-2xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Call Guard backend is connected</p>
            <p className="text-xs text-muted-foreground mt-1">Call activity totals are restricted to administrators. Your call protection setup is still active.</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold font-heading">How Call Guard works</h2>
          <p className="text-sm text-muted-foreground mt-1">The live phone agent and the Vardin analysis backend are separate steps.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Step number="1" title="Caller speaks to Vardin" text="Retell handles the call and asks natural questions about who is calling and why." />
          <Step number="2" title="Retell sends the transcript" text="After the call, the signed call_analyzed webhook is received by Vardin." />
          <Step number="3" title="Vardin decides the risk" text="Vardin analyzes the transcript and returns Safe, Suspicious, or Scam with evidence and actions." />
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><Lock className="w-4 h-4 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Retell webhook</h2>
            <p className="text-sm text-muted-foreground mt-1">Use this endpoint in Retell's post-call webhook configuration.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 min-w-0 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs break-all">{webhookUrl}</code>
          <Button variant="outline" onClick={copyWebhook} className="gap-2 flex-shrink-0">
            {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy URL"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">The endpoint only accepts Retell-signed requests. The signing key stays in Base44 secrets and is never shown here.</p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">Verdict breakdown</h2>
            <p className="text-xs text-muted-foreground mt-1">Aggregate results from all processed Call Guard calls.</p>
          </div>
          {status?.last_activity_at && <span className="text-xs text-muted-foreground">Last activity {new Date(status.last_activity_at).toLocaleString()}</span>}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.entries(VERDICT_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return <div key={key} className="rounded-xl border border-border/50 bg-muted/20 p-4 flex items-center gap-3"><Icon className={`w-5 h-5 ${meta.className}`} /><div><p className="text-sm font-medium">{meta.label}</p><p className="text-2xl font-bold">{counts[key] || 0}</p></div></div>;
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Call reports</h2>
          <p className="text-xs text-muted-foreground mt-1">Internal admin view with summaries, transcripts, Vardin analysis, tactics, and recommended actions.</p>
        </div>
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No Call Guard reports yet.</div>
          ) : reports.map((report) => {
            const meta = VERDICT_META[report.vardin_verdict] || { label: report.processed ? "Pending" : "Processing", icon: Clock3, className: "text-muted-foreground" };
            const Icon = meta.icon;
            return (
              <details key={report.id} className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${meta.className}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{meta.label}{report.vardin_confidence_score != null ? ` · ${report.vardin_confidence_score}/100` : ""}</p>
                    <p className="text-xs text-muted-foreground">{report.created_date ? new Date(report.created_date).toLocaleString() : "Unknown time"} · {report.call_id}</p>
                  </div>
                </summary>
                <div className="border-t border-border/50 p-4 space-y-4">
                  <AdminReportSection title="Call summary"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.call_summary || "No summary provided."}</p></AdminReportSection>
                  <AdminReportSection title="Vardin analysis"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.vardin_explanation || "No Vardin explanation yet."}</p></AdminReportSection>
                  {report.vardin_tactics_detected?.length > 0 && <AdminReportSection title="Tactics detected"><div className="flex flex-wrap gap-2">{report.vardin_tactics_detected.map((tactic, i) => <span key={`${tactic}-${i}`} className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">{tactic}</span>)}</div></AdminReportSection>}
                  {report.vardin_recommended_actions?.length > 0 && <AdminReportSection title="Recommended actions"><ul className="space-y-1">{report.vardin_recommended_actions.map((action, i) => <li key={i} className="text-sm text-muted-foreground">• {action}</li>)}</ul></AdminReportSection>}
                  <AdminReportSection title="Transcript"><pre className="max-h-80 overflow-auto rounded-xl border border-border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono">{report.transcript || "No transcript available."}</pre></AdminReportSection>
                  <AdminReportSection title="Retell analysis data"><pre className="max-h-64 overflow-auto rounded-xl border border-border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono">{report.call_analysis_data || "No analysis data available."}</pre></AdminReportSection>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">Call Guard is intentionally separate from Phone Lookup and Live Guard. Call Guard handles the completed Retell conversation and makes the final Vardin verdict after the call.</p>
      </div>

      {status?.error && <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{status.error}</div>}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "default" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-primary";
  return <div className="rounded-2xl border border-border/50 bg-card p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><Icon className={`w-4 h-4 ${toneClass}`} /></div><p className="text-2xl font-bold mt-2">{value}</p></div>;
}

function Step({ number, title, text }) {
  return <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2"><div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{number}</div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground leading-relaxed">{text}</p></div>;
}
