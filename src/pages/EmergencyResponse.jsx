import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Siren, DollarSign, Lock, CreditCard, MousePointerClick, Monitor, IdCard,
  ChevronDown, Phone, AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert,
  Loader2, Sparkles, Wand2,
} from "lucide-react";

const SCENARIOS = [
  {
    id: "money",
    icon: DollarSign,
    title: "I Sent Money",
    subtitle: "Bank transfer, wire, crypto, or gift cards",
    color: "destructive",
    doNow: [
      "Call your bank's fraud department immediately — request a transfer recall or chargeback",
      "If you sent gift cards, contact the issuer right now (they can sometimes freeze unused cards)",
      "If crypto: contact your exchange immediately — recovery is unlikely but report it for investigation",
      "Gather all evidence: transaction receipts, messages, emails, phone numbers",
    ],
    followUp: [
      "File a police report with your local law enforcement",
      "Report to your national fraud authority (FTC in the US, Action Fraud in the UK)",
      "Monitor your bank statements for unauthorized charges for the next 30 days",
      "Save all evidence — you may need it for insurance or disputes",
    ],
  },
  {
    id: "password",
    icon: Lock,
    title: "I Shared My Password",
    subtitle: "Login credentials for any account",
    color: "destructive",
    doNow: [
      "Change the password for that account immediately",
      "Change the password for every other account that uses the same password",
      "Enable two-factor authentication (2FA) on all important accounts",
      "If it's your email account: check for suspicious forwarding rules and authorized apps",
    ],
    followUp: [
      "Review recent account activity for unauthorized logins",
      "Use a password manager to create unique passwords going forward",
      "Sign out of all active sessions on the compromised account",
      "Consider a credit freeze if personal info was also exposed",
    ],
  },
  {
    id: "card",
    icon: CreditCard,
    title: "I Shared Card or Bank Details",
    subtitle: "Credit card number, bank account, or CVV",
    color: "destructive",
    doNow: [
      "Call your bank or card issuer immediately — report fraud and freeze the card",
      "Request a new card with a new number",
      "Dispute any unauthorized charges",
      "Set up transaction alerts on your account",
    ],
    followUp: [
      "Place a fraud alert with credit bureaus (Equifax, Experian, TransUnion)",
      "Monitor your credit report for new unauthorized accounts",
      "Update autopay settings with your new card number",
      "Review 30 days of statements for unfamiliar charges",
    ],
  },
  {
    id: "link",
    icon: MousePointerClick,
    title: "I Clicked a Suspicious Link",
    subtitle: "Phishing link or downloaded an attachment",
    color: "warning",
    doNow: [
      "Do NOT enter any information if a page opened — close it immediately",
      "If you downloaded a file, do NOT open it — delete it",
      "Run a full malware scan on your device",
      "If you entered any credentials, change those passwords now",
    ],
    followUp: [
      "Clear your browser cache, cookies, and history",
      "Check your browser for suspicious extensions and remove them",
      "Update your browser and operating system to the latest version",
      "Monitor accounts for unusual activity over the next week",
    ],
  },
  {
    id: "remote",
    icon: Monitor,
    title: "I Gave Remote Access",
    subtitle: "Someone controlled my computer remotely",
    color: "destructive",
    doNow: [
      "Disconnect from the internet immediately (turn off Wi-Fi or unplug cable)",
      "Uninstall any software they asked you to install (AnyDesk, TeamViewer, UltraViewer, etc.)",
      "Run a full antivirus/anti-malware scan",
      "Change your important passwords from a DIFFERENT, trusted device",
    ],
    followUp: [
      "Consider professional IT help to check for persistent malware",
      "Back up important files (to a clean external drive)",
      "Enable 2FA on all accounts you accessed from that computer",
      "Monitor financial accounts for unauthorized access",
    ],
  },
  {
    id: "identity",
    icon: IdCard,
    title: "I Shared Personal Info",
    subtitle: "SSN, national ID, date of birth, or address",
    color: "warning",
    doNow: [
      "Place a fraud alert or credit freeze with credit bureaus immediately",
      "Contact your national identity protection service",
      "Change passwords and security questions for important accounts",
      "Report to identity theft authorities",
    ],
    followUp: [
      "Monitor your credit report regularly for new accounts",
      "File an identity theft report with law enforcement",
      "Watch for mail redirection or unexpected bills",
      "Consider an identity protection service for ongoing monitoring",
    ],
  },
];

const COLOR_MAP = {
  destructive: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30" },
};

export default function EmergencyResponse() {
  const [selected, setSelected] = useState(null);
  const [elaboration, setElaboration] = useState("");
  const [aiSteps, setAiSteps] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const handlePersonalizedHelp = async () => {
    if (!elaboration.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiSteps(null);

    try {
      const scenario = SCENARIOS.find((s) => s.id === selected);
      const prompt = `You are Vardin, an AI scam recovery assistant. A user may have already been scammed and needs immediate, personalized help.

${scenario ? `Situation category: "${scenario.title}" — ${scenario.subtitle}` : "No specific category selected — infer from their description."}

The user described their exact situation:
"${elaboration.trim()}"

Provide specific, personalized recovery steps for THIS user's exact situation. Be calm, practical, and actionable. Reference any specific services, banks, apps, or websites they mentioned by name. Focus on what they can do RIGHT NOW to minimize damage, then follow-up steps.

Respond with:
- do_now: 3-5 specific immediate steps tailored to their situation
- follow_up: 2-4 steps for the coming days
- contacts: specific organizations, services, or hotlines to contact (with brief context on why)
- reassurance: a brief, calming 1-2 sentence message acknowledging their situation`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            do_now: { type: "array", items: { type: "string" } },
            follow_up: { type: "array", items: { type: "string" } },
            contacts: { type: "array", items: { type: "string" } },
            reassurance: { type: "string" },
          },
        },
      });

      setAiSteps(result);
    } catch (e) {
      setAiError(e.message || "Could not generate personalized steps. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-md shadow-destructive/20">
            <Siren className="w-5 h-5 text-destructive-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Emergency Response</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Already sent money or shared your info? Don't panic — follow the exact recovery steps for your situation.
        </p>
      </div>

      {/* Emergency Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 animate-slide-up" style={{ animationDelay: "30ms" }}>
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-destructive">Act fast — the sooner you respond, the more you can recover.</p>
          <p className="text-muted-foreground mt-0.5">Choose your situation below and follow the steps in order.</p>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="animate-slide-up" style={{ animationDelay: "50ms" }}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          What happened?
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {SCENARIOS.map((s) => {
            const cfg = COLOR_MAP[s.color];
            const Icon = s.icon;
            const isOpen = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(isOpen ? null : s.id)}
                className={`text-left bg-card rounded-2xl border p-4 transition-all ${
                  isOpen ? `${cfg.border} ring-1 ring-offset-0` : "border-border/50 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${cfg.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{s.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{s.subtitle}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Elaborate with AI */}
      <div className="bg-card rounded-2xl border border-primary/20 p-5 space-y-3 animate-slide-up" style={{ animationDelay: "70ms" }}>
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Describe your exact situation</h3>
          <span className="text-xs text-primary font-medium ml-auto">AI-Powered</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {selected
            ? "Add details about what happened to get personalized recovery steps."
            : "Tell us what happened and we'll generate personalized recovery steps for your situation."}
        </p>
        <Textarea
          value={elaboration}
          onChange={(e) => setElaboration(e.target.value)}
          placeholder="e.g., I sent $500 via Zelle to someone claiming to be from my bank. They called from 1-800-XXX-XXXX and said my account was compromised. I also gave them my online banking username..."
          className="min-h-[100px] resize-none text-sm"
          disabled={aiLoading}
        />
        <Button
          onClick={handlePersonalizedHelp}
          disabled={!elaboration.trim() || aiLoading}
          className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80"
        >
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {aiLoading ? "Analyzing your situation..." : "Get Personalized Recovery Steps"}
        </Button>
        {aiError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" />
            {aiError}
          </div>
        )}
      </div>

      {/* AI Personalized Results */}
      {aiSteps && (
        <div className="space-y-4 animate-slide-up">
          {aiSteps.reassurance && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90 leading-relaxed">{aiSteps.reassurance}</p>
            </div>
          )}
          {aiSteps.do_now?.length > 0 && (
            <div className="bg-card rounded-2xl border-2 border-destructive/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                <h3 className="font-semibold">Do This Now</h3>
                <span className="text-xs text-primary font-medium ml-auto">Personalized</span>
              </div>
              <div className="space-y-3">
                {aiSteps.do_now.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiSteps.follow_up?.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">Follow Up</h3>
                <span className="text-xs text-primary font-medium ml-auto">Personalized</span>
              </div>
              <div className="space-y-3">
                {aiSteps.follow_up.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiSteps.contacts?.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Who to Contact</h3>
              </div>
              <div className="space-y-2">
                {aiSteps.contacts.map((contact, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <span className="text-primary font-bold flex-shrink-0">•</span>
                    {contact}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      {selected && (() => {
        const scenario = SCENARIOS.find((s) => s.id === selected);
        const cfg = COLOR_MAP[scenario.color];
        return (
          <div className="space-y-4 animate-slide-up">
            {/* Do Now */}
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                  <AlertTriangle className={`w-4 h-4 ${cfg.text}`} />
                </div>
                <h3 className="font-semibold">Do This Now</h3>
                <span className="text-xs text-muted-foreground">— Time is critical</span>
              </div>
              <div className="space-y-3">
                {scenario.doNow.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-lg ${cfg.bg} ${cfg.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow Up */}
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">Follow Up</h3>
                <span className="text-xs text-muted-foreground">— Within the next few days</span>
              </div>
              <div className="space-y-3">
                {scenario.followUp.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap gap-2">
              <Link to="/scan">
                <Button variant="outline" size="sm" className="gap-2">
                  <ShieldAlert className="w-3.5 h-3.5" /> Scan the suspicious content
                </Button>
              </Link>
              <Link to="/scam-feed">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-3.5 h-3.5" /> Report this scam
                </Button>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* General reminder */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/30 text-xs text-muted-foreground">
        <Phone className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          In immediate danger? Call your local emergency number. For fraud, contact your bank's 24/7 fraud line and your national consumer protection authority.
        </p>
      </div>
    </div>
  );
}