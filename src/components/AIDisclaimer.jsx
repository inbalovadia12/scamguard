import React from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function AIDisclaimer({ className = "", highStakes = false, compact = false, ...props }) {
  return (
    <div className={`flex gap-2.5 px-3.5 py-2.5 bg-warning/5 border border-warning/20 rounded-xl ${className}`} {...props}>
      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground/80">AI-generated assessment:</span>{" "}
        Vardin uses automated predictions and pattern analysis that may be inaccurate, incomplete, or out of date. A low-risk result does not guarantee that a call, message, link, website, image, or person is safe, and a high-risk result does not by itself prove fraud or malicious intent.
        {!compact && " Verify important information independently and do not rely solely on Vardin for financial, legal, medical, security, or other high-stakes decisions."}
        {highStakes && " For urgent or high-stakes situations, contact the relevant bank, service provider, qualified professional, or emergency authority directly."}
        {" "}<Link to="/terms" className="font-medium text-primary hover:underline">Learn more</Link>.
      </p>
    </div>
  );
}