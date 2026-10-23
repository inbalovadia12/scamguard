import React from "react";
import { AlertTriangle } from "lucide-react";
import { SEVERITIES, normalizeSeverity } from "@/components/fineprint/riskLevels";

export default function RedFlagCard({ flag }) {
  const severity = normalizeSeverity(flag?.severity);
  const config = SEVERITIES[severity];

  return (
    <div className={`rounded-2xl border ${config.border} bg-card p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
          <AlertTriangle className={`w-4 h-4 ${config.text}`} />
        </div>
        <p className="font-semibold text-sm flex-1 min-w-0 pt-1.5">{flag?.title}</p>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${config.bg} ${config.text} flex-shrink-0`}>
          {config.label}
        </span>
      </div>

      {flag?.exact_quote && (
        <blockquote className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
          &ldquo;{flag.exact_quote}&rdquo;
        </blockquote>
      )}

      {flag?.plain_explanation && (
        <p className="text-sm text-foreground/80 leading-relaxed">{flag.plain_explanation}</p>
      )}

      {flag?.suggested_action && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-primary">What you can do: </span>
          {flag.suggested_action}
        </p>
      )}
    </div>
  );
}