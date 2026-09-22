import React from "react";
import { ShieldCheck, Users, ArrowRightLeft } from "lucide-react";

// Makes it unmissable that Vardin works both ways: a guardian setting up
// protection for a senior, or a senior setting it up for themselves.
// variant: "card" (default, light surface) | "cinematic" (dark overlay surface)
export default function DualUseBanner({ variant = "card", className = "" }) {
  const isCinematic = variant === "cinematic";

  if (isCinematic) {
    return (
      <div className={`grid w-[min(92vw,470px)] gap-3 sm:grid-cols-2 ${className}`}>
        {[
          { icon: Users, title: "For a guardian", text: "Set up Vardin to protect a parent or loved one.", tone: "guardian" },
          { icon: ShieldCheck, title: "For yourself", text: "Use Vardin directly to check what reaches you.", tone: "self" },
        ].map((c) => (
          <div key={c.tone} className="rounded-2xl border border-white/[0.12] bg-white/[0.035] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.26)] backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2f8f83]/15 text-[#79c9bd]">
              <c.icon className="h-4 w-4" />
            </div>
            <div className="mt-3 text-sm font-medium text-white/88">{c.title}</div>
            <p className="mt-1 text-[11px] leading-5 text-white/52">{c.text}</p>
          </div>
        ))}
        <div className="col-span-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] py-2 text-[10px] tracking-[0.14em] text-white/55">
          <ArrowRightLeft className="h-3.5 w-3.5 text-[#83b9c5]" />
          ONE ACCOUNT · WORKS BOTH WAYS
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 to-transparent p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold tracking-wide text-primary">ONE ACCOUNT · WORKS BOTH WAYS</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Guardian mode</div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Set up Vardin to protect a parent, child, or loved one — you'll get alerts when they check something risky.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Self mode</div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Use Vardin directly to check messages, links, and calls that reach you — for your own peace of mind.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}