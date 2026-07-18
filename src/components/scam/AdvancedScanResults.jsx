import React, { useState } from "react";
import { Copy, Share2, Download, RotateCcw, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import RiskBadge, { getRiskLevelFromScore, getRiskBarColor } from "@/components/scam/RiskBadge";

function VirusTotalBadge({ vt }) {
  if (!vt) return null;
  const isDanger = vt.malicious > 0;
  return (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${isDanger ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-success/10 text-success border-success/20"}`}>
      <span className="font-semibold">VirusTotal:</span>
      <span>{vt.malicious}/{vt.total_engines} malicious detections</span>
      <span className="opacity-70">· Reputation: {vt.reputation}</span>
    </div>
  );
}

function QuickResult({ a }) {
  const scam = a.is_scam;
  return (
    <div className={`rounded-2xl border p-6 space-y-3 ${scam ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}`}>
      <div className={`text-2xl font-bold ${scam ? "text-destructive" : "text-success"}`}>
        {scam ? "⚠️ Likely Scam" : "✅ Likely Safe"}
      </div>
      <p className="text-base leading-relaxed">{a.verdict}</p>
      {a.confidence != null && <p className="text-sm text-muted-foreground">Confidence: {a.confidence}%</p>}
    </div>
  );
}

function RiskScoreResult({ a }) {
  const score = a.risk_score || 0;
  const level = a.risk_level || getRiskLevelFromScore(score);
  return (
    <div className="rounded-2xl border border-border/50 p-6 space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold font-heading">{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${getRiskBarColor(score)} transition-all duration-1000`} style={{ width: `${score}%` }} />
      </div>
      <RiskBadge level={level} size="lg" />
      {a.summary && <p className="text-sm text-muted-foreground">{a.summary}</p>}
    </div>
  );
}

function RedFlagsResult({ a }) {
  const flags = a.red_flags || [];
  const risk = a.overall_risk || "low";
  return (
    <div className="rounded-2xl border border-border/50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{flags.length} Red Flag{flags.length !== 1 ? "s" : ""} Found</span>
        <RiskBadge level={risk} />
      </div>
      {flags.length > 0 ? (
        <ul className="space-y-2">
          {flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No red flags detected ✅</p>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</h4>
      {children}
    </div>
  );
}

function DetailedResult({ a }) {
  const score = a.risk_score ?? 0;
  const level = a.risk_level || getRiskLevelFromScore(score);
  return (
    <div className="rounded-2xl border border-border/50 p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RiskBadge level={level} size="lg" />
        {a.is_scam != null && (
          <span className={`text-sm font-bold ${a.is_scam ? "text-destructive" : "text-success"}`}>
            {a.is_scam ? "⚠️ Likely Scam" : "✅ Likely Safe"}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold font-heading">{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${getRiskBarColor(score)} transition-all duration-1000`} style={{ width: `${score}%` }} />
      </div>
      {a.confidence != null && <p className="text-sm text-muted-foreground">Confidence: {a.confidence}%</p>}
      {a.scam_category && <Section label="Scam Category"><p className="text-sm">{a.scam_category}</p></Section>}
      {a.explanation && <Section label="Explanation"><p className="text-sm leading-relaxed">{a.explanation}</p></Section>}
      {a.what_they_want && <Section label="What They Want"><p className="text-sm">{a.what_they_want}</p></Section>}
      {a.tactics_detected?.length > 0 && (
        <Section label="Tactics Detected">
          <ul className="space-y-1">{a.tactics_detected.map((t, i) => <li key={i} className="text-sm">• {t}</li>)}</ul>
        </Section>
      )}
      {a.red_flags?.length > 0 && (
        <Section label="Red Flags">
          <ul className="space-y-1">{a.red_flags.map((f, i) => <li key={i} className="text-sm">• {f}</li>)}</ul>
        </Section>
      )}
      {a.evidence_found?.length > 0 && (
        <Section label="Evidence Found">
          <ul className="space-y-1">{a.evidence_found.map((e, i) => <li key={i} className="text-sm">• {e}</li>)}</ul>
        </Section>
      )}
      {a.sources_checked?.length > 0 && (
        <Section label="Sources Checked">
          <div className="flex flex-wrap gap-1.5">
            {a.sources_checked.map((s, i) => <span key={i} className="text-xs px-2 py-1 bg-muted rounded-lg">{s}</span>)}
          </div>
        </Section>
      )}
      {a.next_steps?.length > 0 && (
        <Section label="Recommended Actions">
          <ul className="space-y-1">{a.next_steps.map((s, i) => <li key={i} className="text-sm">→ {s}</li>)}</ul>
        </Section>
      )}
    </div>
  );
}

export default function AdvancedScanResults({ data, onRescan }) {
  const [copied, setCopied] = useState(false);
  const a = data.analysis || {};
  const mode = data.answer_type || "detailed";

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(a, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(a, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vardin-scan-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    const text = JSON.stringify(a, null, 2);
    if (navigator.share) navigator.share({ title: "Vardin Scan Report", text }).catch(() => {});
    else { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="space-y-4">
      <VirusTotalBadge vt={data.virustotal} />
      {mode === "quick" && <QuickResult a={a} />}
      {mode === "risk_score" && <RiskScoreResult a={a} />}
      {mode === "red_flags" && <RedFlagsResult a={a} />}
      {mode === "detailed" && <DetailedResult a={a} />}

      {data.timestamp && (
        <p className="text-xs text-muted-foreground">Scanned on {new Date(data.timestamp).toLocaleString()}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
          <Share2 className="w-4 h-4" />Share
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="w-4 h-4" />Download
        </Button>
        <Button variant="outline" size="sm" onClick={onRescan} className="gap-1.5">
          <RotateCcw className="w-4 h-4" />Scan Again
        </Button>
      </div>
    </div>
  );
}