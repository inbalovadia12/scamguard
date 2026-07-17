import React from "react";

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function SeasonalCalendar({ scams }) {
  if (!scams?.length) return null;

  return (
    <div className="space-y-2">
      {scams.map((scam, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs font-medium w-28 truncate flex-shrink-0" title={scam.name}>
            {scam.name}
          </span>
          <div className="flex gap-0.5 flex-1">
            {MONTH_LABELS.map((label, idx) => {
              const active = scam.peak_months?.includes(idx + 1);
              return (
                <div
                  key={idx}
                  className={`flex-1 h-5 rounded text-[9px] flex items-center justify-center font-medium transition-colors ${
                    active
                      ? 'bg-primary/25 text-primary'
                      : 'bg-muted/40 text-muted-foreground/50'
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}