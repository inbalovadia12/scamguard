import React from "react";
import { AlertTriangle, ThumbsUp, Lightbulb, MessageCircle, ShieldAlert, Info } from "lucide-react";
import { getFeedbackSentiment } from "./feedbackUtils";

const SEVERITY_STYLES = {
  caution: { icon: Info, color: "text-muted-foreground", border: "border-border/50", bg: "bg-muted/20" },
  suspicious: { icon: AlertTriangle, color: "text-warning", border: "border-warning/20", bg: "bg-warning/5" },
  high: { icon: ShieldAlert, color: "text-destructive", border: "border-destructive/20", bg: "bg-destructive/5" },
};

const COACHING_STYLES = {
  positive: { icon: ThumbsUp, color: "text-success", border: "border-success/20", bg: "bg-success/5" },
  warning: { icon: AlertTriangle, color: "text-destructive", border: "border-destructive/20", bg: "bg-destructive/5" },
  neutral: { icon: Lightbulb, color: "text-muted-foreground", border: "border-border/50", bg: "bg-muted/20" },
};

export default function WarningPanel({ warnings, tactics, coaching }) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 flex flex-col h-[340px] sm:h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Risk Assessment</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {coaching?.length > 0 && (
          <div className="space-y-2">
            {coaching.map((c, i) => {
              const sentiment = getFeedbackSentiment(c.text);
              const style = COACHING_STYLES[sentiment];
              const Icon = style.icon;
              return (
                <div key={i} className={`text-sm p-3 rounded-xl border ${style.bg} ${style.border}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 ${style.color} flex-shrink-0 mt-0.5`} />
                    <p className={`${style.color} font-medium leading-relaxed`}>{c.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tactics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-1">
            {tactics.map((t, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted/40 text-muted-foreground font-medium">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {warnings.length === 0 && (!coaching || coaching.length === 0) ? (
          <div className="text-center py-8">
            <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No notable risk indicators yet. This doesn't guarantee the conversation is safe, but nothing suspicious has been detected so far.
            </p>
          </div>
        ) : (
          warnings.map((w, i) => {
            const severity = w.severity || "caution";
            const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.caution;
            const Icon = style.icon;
            return (
              <div key={i} className={`p-3 rounded-xl border ${style.bg} ${style.border} space-y-1.5`}>
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 ${style.color} flex-shrink-0 mt-0.5`} />
                  <p className={`text-sm font-semibold ${style.color}`}>{w.title || w.text}</p>
                </div>
                {w.explanation && <p className="text-sm text-muted-foreground leading-relaxed pl-6">{w.explanation}</p>}
                {w.action && (
                  <p className="text-xs text-foreground/80 leading-relaxed pl-6">
                    <span className="font-medium">What to do: </span>{w.action}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}