import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Siren, MousePointerClick, KeyRound, CreditCard, ShieldCheck, Download } from "lucide-react";
import AskFamilyButton from "@/components/family/AskFamilyButton";

const ACTIONS = [
  { key: "clicked_link", label: "I clicked a link", icon: MousePointerClick, guidance: "Don't enter any information on the page. If you logged in, change that password and enable 2FA. Run a malware scan on your device. Treat any details you entered as compromised." },
  { key: "gave_password", label: "I gave my password", icon: KeyRound, guidance: "Change that password immediately, starting with the affected account. Enable two-factor authentication. If you reused it, change it on every site that shares it." },
  { key: "sent_money", label: "I sent money", icon: CreditCard, guidance: "Call your bank or card provider right now to dispute the charge or recall the transfer. Contact your payment app's fraud team. File reports at FTC.gov and IC3.gov." },
  { key: "gave_code", label: "I gave a verification code", icon: ShieldCheck, guidance: "That code was likely 2FA — the scammer may have accessed your account. Change that account's password now and review recent login activity and active sessions." },
  { key: "downloaded", label: "I downloaded something", icon: Download, guidance: "Disconnect from the internet, run a full antivirus scan, and uninstall the download. Revoke any permissions it was granted. Change sensitive passwords from a clean device." },
];

export default function PostScamResponsePanel({ onBack }) {
  const [selected, setSelected] = useState(null);
  const action = ACTIONS.find((a) => a.key === selected);

  return (
    <div className="rounded-3xl border border-warning/40 bg-warning/5 p-5 sm:p-6 space-y-4 animate-scale-in">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-warning" />
        <h2 className="text-lg font-bold font-heading text-warning">You already interacted — let's act fast</h2>
      </div>
      <p className="text-sm text-muted-foreground">Select what happened so we can guide your next steps. Quick action prevents financial loss.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const active = selected === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setSelected(a.key)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium text-left transition-all ${active ? "border-warning bg-warning/15 text-warning" : "border-border/50 bg-card hover:border-warning/40"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" /> {a.label}
            </button>
          );
        })}
      </div>

      {action && (
        <div className="space-y-4 pt-2 border-t border-warning/20 animate-fade-in">
          <div className="rounded-2xl bg-card border border-border/50 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Do this now</h3>
            <p className="text-sm leading-relaxed">{action.guidance}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AskFamilyButton analysisType="scam_analysis" threatExcerpt={`Post-scam help: ${action.label}`} riskLevel="high" scamType="other" />
            <Link to="/emergency-response">
              <Button className="gap-2 bg-gradient-to-r from-warning to-warning/80">
                <Siren className="w-4 h-4" /> Get Emergency Help
              </Button>
            </Link>
          </div>
        </div>
      )}

      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to scanning
      </button>
    </div>
  );
}