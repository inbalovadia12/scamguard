import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  PhoneCall, Loader2, ShieldAlert, ShieldCheck, AlertTriangle, HelpCircle, BookOpen, Database, KeyRound, ArrowLeft,
} from "lucide-react";

const STATUS_META = {
  SCAM: { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", word: "Scam Likely" },
  SPAM: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", word: "Spam" },
  SUSPICIOUS: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", word: "Suspicious" },
  SAFE: { icon: ShieldCheck, color: "text-success", bg: "bg-success/10", border: "border-success/20", word: "Safe" },
  UNKNOWN: { icon: HelpCircle, color: "text-muted-foreground", bg: "bg-muted", border: "border-border/50", word: "Unknown" },
};

const ENDPOINTS = [
  { name: "Entitlement", method: "getCallDirectoryEntitlement", desc: "Check the user's plan includes caller-ID." },
  { name: "Snapshot", method: "getCallDirectorySnapshot", desc: "Full published dataset for the on-device Call Directory." },
  { name: "Changes", method: "getCallDirectoryChanges", desc: "Incremental ADD/UPDATE/REMOVE since a version." },
  { name: "Live check", method: "checkIncomingCaller", desc: "Check one number against databases (this tester)." },
];

export default function MobileCallerId() {
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    if (!number.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("checkIncomingCaller", { phone_number: number.trim() });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
      } else {
        setResult(res.data);
      }
    } catch (e) {
      toast({ title: "Lookup failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const meta = result ? STATUS_META[result.status] || STATUS_META.UNKNOWN : null;
  const StatusIcon = meta?.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <PhoneCall className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">iOS Caller-ID Integration</h1>
          <p className="text-sm text-muted-foreground">
            Internal developer tool for the native CallKit caller-identification backend. Hidden from main navigation.
          </p>
        </div>
      </div>

      <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold font-heading">How the Call Directory Extension works</h2>
        </div>
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Apple's <strong>CallKit Call Directory app extension</strong> identifies incoming unknown callers by matching
            them against a list of phone numbers + labels pre-loaded on-device. The extension subclass{" "}
            <code className="text-foreground">CXCallDirectoryProvider</code> and, in{" "}
            <code className="text-foreground">beginRequest(with:)</code>, calls{" "}
            <code className="text-foreground">context.addIdentificationEntry(withNextSequentialPhoneNumber:label:)</code>{" "}
            for each entry <em>sorted ascending by number</em>, then <code className="text-foreground">context.completeRequest()</code>.
          </p>
          <p>
            There is no live network at call time — the list must be synced ahead of time. The native app fetches the
            snapshot, stores it (Core Data/SQLite), and calls{" "}
            <code className="text-foreground">CXCallDirectoryManager.reloadExtension</code> after applying incremental changes
            via <code className="text-foreground">BGTaskScheduler</code>.
          </p>
          <p>
            For numbers <em>not</em> in the on-device list, the app calls <code className="text-foreground">checkIncomingCaller</code>{" "}
            (below) to look the number up against public scam/spam databases and tell the user if it's a scam.
          </p>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold font-heading">Live caller check</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Test the backend that powers an unknown-incoming-caller lookup. It reads Vardin's canonical reputation index
          first (instant), then falls back to live web research if the number is new or stale.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. +1 555 010 1234"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          />
          <Button onClick={handleCheck} disabled={loading || !number.trim()} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
            Check
          </Button>
        </div>

        {result && StatusIcon && (
          <div className={`rounded-xl border p-4 space-y-3 ${meta.bg} ${meta.border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon className={`w-5 h-5 ${meta.color}`} />
                <span className={`font-bold ${meta.color}`}>{meta.word}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{result.phone_number}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Risk level" value={result.risk_level} />
              <Stat label="Risk score" value={`${result.reputation_score}/100`} />
              <Stat label="Confidence" value={`${result.confidence}%`} />
              <Stat label="Source" value={result.cached ? "Cached" : "Live lookup"} />
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Caller-ID label: </span>
              <span className="font-medium">{result.caller_id_label || "—"}</span>
            </div>
            {result.summary && <p className="text-sm text-muted-foreground">{result.summary}</p>}
            {result.sources?.length > 0 && (
              <div className="text-xs space-y-1">
                <span className="text-muted-foreground">Sources:</span>
                {result.sources.slice(0, 5).map((s, i) => (
                  <a key={i} href={s} target="_blank" rel="noreferrer" className="block text-primary hover:underline truncate">
                    {s}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold font-heading">Backend endpoints</h2>
        </div>
        <div className="space-y-2">
          {ENDPOINTS.map((e) => (
            <div key={e.method} className="border border-border/40 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{e.name}</span>
                <code className="text-xs text-primary">{e.method}</code>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{e.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 text-xs bg-muted/40 border border-border/40 rounded-lg p-3">
          <KeyRound className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            Requires a Vardin Plus or Premium plan. The on-device list uses the published dataset only; the live check
            is the fallback for numbers not yet on-device.
          </span>
        </div>
      </section>

      <div className="text-center pt-1">
        <Link to="/mobile-app" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Vardin Mobile
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-card/60 border border-border/40 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5 capitalize">{value}</div>
    </div>
  );
}