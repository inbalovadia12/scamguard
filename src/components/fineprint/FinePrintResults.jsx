import React from "react";
import { FileText, AlertTriangle, ListChecks, HelpCircle, Info, ShieldAlert } from "lucide-react";
import RiskGauge from "@/components/fineprint/RiskGauge";
import RedFlagCard from "@/components/fineprint/RedFlagCard";
import { sortRedFlags } from "@/components/fineprint/riskLevels";

const LEGAL_NOTE =
  "This is an AI-generated summary for information only, not legal advice. For important decisions, consult a qualified professional.";

function Section({ icon: Icon, title, tint, children }) {
  return (
    <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tint || "text-primary"}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function keyTermRows(keyTerms) {
  return (Array.isArray(keyTerms) ? keyTerms : []).map((term, index) => {
    if (typeof term === "string") {
      return { key: index, label: "", detail: term };
    }
    return { key: index, label: term?.label || term?.term || "", detail: term?.detail || term?.value || "" };
  }).filter((row) => row.label || row.detail);
}

export default function FinePrintResults({ analysis, actions }) {
  if (!analysis) return null;

  const flags = sortRedFlags(analysis.red_flags);
  const terms = keyTermRows(analysis.key_terms);
  const missing = Array.isArray(analysis.missing_info) ? analysis.missing_info : [];
  const questions = Array.isArray(analysis.questions_to_ask) ? analysis.questions_to_ask : [];

  return (
    <div className="space-y-5">
      <RiskGauge score={analysis.risk_score} level={analysis.risk_level} />

      {analysis.summary && (
        <Section icon={FileText} title="What you are agreeing to">
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{analysis.summary}</p>
        </Section>
      )}

      {flags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Things to watch out for ({flags.length})
          </h3>
          {flags.map((flag, index) => (
            <RedFlagCard key={index} flag={flag} />
          ))}
        </div>
      )}

      {terms.length > 0 && (
        <Section icon={ListChecks} title="Key terms">
          <dl className="divide-y divide-border/60">
            {terms.map((row) => (
              <div key={row.key} className="py-2.5 first:pt-0 last:pb-0">
                {row.label && <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>}
                <dd className="text-sm text-foreground/80 leading-relaxed">{row.detail}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {missing.length > 0 && (
        <Section icon={ShieldAlert} title="What this document leaves out" tint="text-warning">
          <p className="text-xs text-muted-foreground">A fair document of this type usually covers these:</p>
          <ul className="space-y-2">
            {missing.map((item, index) => (
              <li key={index} className="text-sm text-foreground/80 leading-relaxed flex gap-2">
                <span className="text-warning flex-shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {questions.length > 0 && (
        <Section icon={HelpCircle} title="Questions to ask before you sign">
          <ol className="space-y-2.5">
            {questions.map((question, index) => (
              <li key={index} className="text-sm text-foreground/80 leading-relaxed flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {actions}

      <p className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-2xl p-3.5 leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        {LEGAL_NOTE}
      </p>
    </div>
  );
}