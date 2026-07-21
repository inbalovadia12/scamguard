import React from "react";
import {
  ShieldAlert, ShieldCheck, ExternalLink, Database, UserSearch,
  Info, CheckCircle2, AlertTriangle, FileText, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const LEVEL_META = {
  low: {
    label: "Low Exposure",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
    icon: ShieldCheck,
  },
  medium: {
    label: "Moderate Exposure",
    gradient: "from-amber-400 via-orange-500 to-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/20",
    icon: AlertTriangle,
  },
  high: {
    label: "High Exposure",
    gradient: "from-rose-500 via-red-500 to-orange-600",
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    border: "border-rose-500/20",
    icon: ShieldAlert,
  },
};

const BROKER_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-purple-500",
  "from-cyan-500 to-blue-500",
  "from-teal-500 to-emerald-500",
];

function ScoreGauge({ score, level }) {
  const meta = LEVEL_META[level] || LEVEL_META.medium;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
          <circle cx="72" cy="72" r="64" fill="none" strokeWidth="10" className="stroke-muted" />
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <circle
            cx="72" cy="72" r="64" fill="none" strokeWidth="10"
            stroke="url(#scoreGrad)" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 402} 402`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-heading">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${meta.bg} ${meta.border} border`}>
        <meta.icon className={`w-4 h-4 ${meta.text}`} />
        <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {count != null && (
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

export default function IdentityExposureResults({ data, previewUrl }) {
  const result = data.result || data;
  const score = result.exposure_score || 0;
  const level = result.exposure_level || "medium";
  const brokers = result.data_brokers || [];
  const personalInfo = result.personal_info_found || [];
  const publicProfiles = result.public_profiles || [];
  const actions = result.recommended_actions || [];
  const sources = result.sources || [];

  return (
    <div className="space-y-6">
      {/* Score + Summary */}
      <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 luxury-card-hover">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreGauge score={score} level={level} />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <h3 className="text-lg font-bold font-heading">Identity Exposure Report</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Data Removal Tool + Found Websites */}
      {brokers.length > 0 && (
        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 sm:p-6">
          <SectionHeader icon={Database} title="Websites Displaying Your Data" count={brokers.length} />

          {/* Single data removal tool */}
          <div className="mb-5 p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-primary/5 to-cyan-500/10 border border-primary/15 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold">Data Removal Tool</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use a professional data removal service to automatically delete your personal information from data brokers and people search sites.
              </p>
            </div>
            <a href="https://joindeleteme.com" target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-r from-violet-500 via-primary to-cyan-500 border-0 gap-2">
                <ExternalLink className="w-4 h-4" />
                Remove My Data
              </Button>
            </a>
          </div>

          {/* Found websites list */}
          <div className="space-y-2">
            {brokers.map((broker, i) => {
              const grad = BROKER_GRADIENTS[i % BROKER_GRADIENTS.length];
              const rawUrl = broker.website_url || broker.opt_out_url || "";
              let url = "";
              try { if (rawUrl) url = new URL(rawUrl).href; } catch {}
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 luxury-card-hover">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0`}>
                    <UserSearch className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{broker.name}</h4>
                    {broker.info_exposed && (
                      <p className="text-xs text-muted-foreground truncate">{broker.info_exposed}</p>
                    )}
                  </div>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Listing
                      </Button>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Personal Info Found */}
        {personalInfo.length > 0 && (
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5">
            <SectionHeader icon={Info} title="Personal Info Found" count={personalInfo.length} />
            <div className="flex flex-wrap gap-2">
              {personalInfo.map((info, i) => (
                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/15">
                  {info}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Public Profiles */}
        {publicProfiles.length > 0 && (
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5">
            <SectionHeader icon={Globe} title="Public Profiles" count={publicProfiles.length} />
            <div className="space-y-1.5">
              {publicProfiles.map((profile, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary/50" />
                  <span className="leading-relaxed">{profile}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommended Actions */}
      {actions.length > 0 && (
        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 sm:p-6">
          <SectionHeader icon={CheckCircle2} title="Recommended Actions" count={actions.length} />
          <div className="space-y-3">
            {actions.map((action, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5">
          <SectionHeader icon={FileText} title="Sources Checked" count={sources.length} />
          <div className="flex flex-wrap gap-2">
            {sources.slice(0, 20).map((source, i) => (
              <a key={i} href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[220px]">
                {source}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}