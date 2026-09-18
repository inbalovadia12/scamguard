import { UserCheck, UserX } from "lucide-react";

// Reusable "Who is this from?" toggle for message-check surfaces.
// value: "" | "known" | "unknown". Tapping the active option clears it.
// The chosen value is sent to analyzeMessage as sender_context so the LLM
// can weigh a recognized contact vs. a stranger appropriately.
export default function SenderContextToggle({ value, onChange }) {
  const options = [
    { value: "known", label: "Known sender", hint: "In your contacts", icon: UserCheck },
    { value: "unknown", label: "Unknown sender", hint: "Not in your contacts", icon: UserX },
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Who is this from?</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? "" : opt.value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <opt.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-left leading-tight">
                <span className="block">{opt.label}</span>
                <span className="block text-[10px] font-normal text-muted-foreground">{opt.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}