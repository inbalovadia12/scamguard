import React from "react";

const FLAG_INFO = {
  "money_request (from caller)": {
    title: "💳 Money Request",
    action: "Do not give payment information",
  },
  "threat (from caller)": {
    title: "⚠️ Threat Detected",
    action: "Do not comply under pressure",
  },
  "personal_info_request (from caller)": {
    title: "🔒 Personal Info Request",
    action: "Never give passwords or sensitive account details",
  },
  "urgency (from caller)": {
    title: "⏰ Pressure Tactic",
    action: "Pause and verify independently",
  },
  "authority_claim (from caller)": {
    title: "🏢 Authority Impersonation",
    action: "Call the real organization using an official number",
  },
};

export default function RedFlagDisplay({ flags = [] }) {
  const visibleFlags = flags.map((flag) => FLAG_INFO[flag]).filter(Boolean);
  if (visibleFlags.length === 0) return null;

  return (
    <div className="space-y-3" aria-label="Red flags detected">
      {visibleFlags.map((info, index) => (
        <div key={`${info.title}-${index}`} className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <div className="font-bold text-red-900">{info.title}</div>
          <div className="font-semibold text-sm text-red-700 mt-2">✋ {info.action}</div>
        </div>
      ))}
    </div>
  );
}
