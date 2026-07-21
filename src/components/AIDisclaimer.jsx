import React from "react";
import { AlertTriangle } from "lucide-react";

export default function AIDisclaimer({ className = "", ...props }) {
  return (
    <div className={`flex gap-2.5 px-3.5 py-2.5 bg-warning/5 border border-warning/20 rounded-xl ${className}`} {...props}>
      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        AI is not always right. Use your own judgment and verify through multiple sources before making decisions.
      </p>
    </div>
  );
}