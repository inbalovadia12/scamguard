import React from "react";
import RiskBadge, { getRiskLevelFromScore } from "@/components/scam/RiskBadge";
import ThreatExplanation from "@/components/scam/ThreatExplanation";
import ResultActions from "@/components/scam/ResultActions";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, FlaskConical, TrendingDown, Droplets, Link2,
} from "lucide-react";

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}
function riskTone(level) {
  return level === "high" ? "destructive" : level === "medium" ? "warning" : level === "low" ? "success" : "neutral";
}

function CryptoChip({ icon: Icon, label, value, tone }) {
  const valueColor =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 bg-card">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`text-sm font-medium ${valueColor}`}>{value}</div>
      </div>
    </div>
  );
}

export default function CryptoScanResult({ result, mode }) {
  const risk = result.risk_level || getRiskLevelFromScore(result.risk_score);

  return (
    <div className="space-y-5">
      <RiskBadge risk={risk} score={result.risk_score} />

      {mode === "address" && (
        <div className="grid grid-cols-2 gap-2.5">
          <CryptoChip
            icon={result.contract_verified ? ShieldCheck : ShieldAlert}
            label="Contract"
            value={result.contract_verified ? "Verified" : "Unverified"}
            tone={result.contract_verified ? "success" : "warning"}
          />
          <CryptoChip icon={FlaskConical} label="Honeypot Risk" value={cap(result.honeypot_risk)} tone={riskTone(result.honeypot_risk)} />
          <CryptoChip icon={TrendingDown} label="Rug-Pull Risk" value={cap(result.rug_pull_risk)} tone={riskTone(result.rug_pull_risk)} />
          <CryptoChip icon={Droplets} label="Liquidity" value={result.liquidity_status || "Unknown"} tone="neutral" />
        </div>
      )}

      {result.is_likely_scam && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm font-medium text-destructive">This is very likely a scam — do not send funds or connect your wallet.</p>
        </div>
      )}

      <ThreatExplanation analysis={result} />

      {result.red_flags?.length > 0 && (
        <div className="bg-muted/50 rounded-2xl p-5 space-y-2">
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Red Flags</h3>
          <ul className="space-y-1.5">
            {result.red_flags.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-destructive flex-shrink-0">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.next_steps?.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-2">
          <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">Next Steps</h3>
          <ul className="space-y-1.5">
            {result.next_steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary flex-shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.sources?.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Sources</h3>
          {result.sources.map((s, i) => (
            <a key={i} href={s} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
              <Link2 className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{s}</span>
            </a>
          ))}
        </div>
      )}

      <ResultActions analysis={result} analysisType="scam_analysis" messageType="crypto_investment" />
    </div>
  );
}