import React from "react";
import { normalizeLevel } from "@/components/fineprint/riskLevels";

// Semicircle arc length for the 80px-radius path used below.
const ARC_LENGTH = 251.3;

export default function RiskGauge({ score, level }) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const config = normalizeLevel(level, value);
  const dash = (value / 100) * ARC_LENGTH;

  return (
    <div className={`rounded-3xl border-2 ${config.border} ${config.bg} p-5 sm:p-6`}>
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <svg viewBox="0 0 200 118" className="w-[132px] h-[78px] sm:w-[170px] sm:h-[100px]">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              strokeWidth="16"
              strokeLinecap="round"
              className="text-border"
              stroke="currentColor"
            />
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              strokeWidth="16"
              strokeLinecap="round"
              className={config.stroke}
              stroke="currentColor"
              strokeDasharray={`${dash} ${ARC_LENGTH}`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center pointer-events-none">
            <p className={`text-2xl sm:text-3xl font-bold font-heading leading-none ${config.text}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">out of 100</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Risk score</p>
          <h2 className={`text-xl sm:text-2xl font-bold font-heading ${config.text}`}>{config.label}</h2>
          <p className="text-sm text-foreground/80 mt-1">{config.tag}</p>
        </div>
      </div>
    </div>
  );
}