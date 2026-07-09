import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function TruncatedText({ text, maxChars = 80, className = "" }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;
  const isLong = text.length > maxChars;
  const display = expanded || !isLong ? text : text.slice(0, maxChars) + "…";

  return (
    <div className={className}>
      <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
        {display}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>See more <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}