import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Bot, Check, ChevronRight, Image as ImageIcon,
  Link2, Phone, Radio, ScanLine, ShieldAlert, ShieldCheck, Users, X,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];

const productScenes = [
  {
    eyebrow: "PHONE GUARD",
    title: "Context starts with the call.",
    support: "Before you answer, see more than a number.",
    visual: "caller",
  },
  {
    eyebrow: "CALL GUARD",
    title: "A signal can change the conversation.",
    support: "Vardin surfaces risk without getting in the way.",
    visual: "call-risk",
  },
  {
    eyebrow: "RISK SIGNALS",
    title: "Look beyond the number itself.",
    support: "Reports, reputation, and patterns are brought together.",
    visual: "signals",
  },
  {
    eyebrow: "SCAM ANALYSIS",
    title: "Turn the signal into a clear decision.",
    support: "A concise result, not another thing to decipher.",
    visual: "verdict",
  },
  {
    eyebrow: "AI ANALYSIS",
    title: "Understand <em>why</em> it may be suspicious.",
    support: "Vardin explains the tactics behind the warning.",
    visual: "explain",
  },
  {
    eyebrow: "UNIVERSAL SCAN",
    title: "Messages. Links. Numbers. Screenshots.",
    support: "Start with the interaction in front of you.",
    visual: "scan",
  },
  {
    eyebrow: "IMAGE SCAN",
    title: "A screenshot can carry a warning too.",
    support: "Check a suspicious page, profile, or QR code.",
    visual: "image",
  },
  {
    eyebrow: "LIVE PROTECTION",
    title: "Stay present during a live call.",
    support: "Call Guard can surface a warning as things unfold.",
    visual: "live",
  },
  {
    eyebrow: "FAMILY PROTECTION",
    title: "Give the people you love another set of eyes.",
    support: "Keep important alerts visible to the right person.",
    visual: "family",
  },
  {
    eyebrow: "LOCAL INTELLIGENCE",
    title: "A pattern is easier to spot together.",
    support: "Community reports add context when it matters.",
    visual: "intel",
  },
  {
    eyebrow: "VARDIN",
    title: "Pause. Understand. Decide.",
    support: "A quieter way to handle the unexpected.",
    visual: "summary",
  },
];

const textScenes = {
  public: [
    {
      eyebrow: "VARDIN · SCAMGUARD",
      title: "Know what you're dealing with.",
      support: "Context for calls, messages, links, and the moments that do not feel quite right.",
      visual: "empty",
    },
    {
      eyebrow: "VARDIN · SCAMGUARD",
      title: "Some scams look completely ordinary.",
      visual: "empty",
    },
    {
      eyebrow: "UNKNOWN CALLER",
      title: "An unknown number.",
      visual: "number",
    },
  ],
  onboarding: [
    {
      eyebrow: "VARDIN · WELCOME",
      title: "Let's show you how Vardin works.",
      visual: "empty",
    },
    {
      eyebrow: "A QUIET START",
      title: "Because not every suspicious interaction looks suspicious.",
      visual: "empty",
    },
    {
      eyebrow: "CONTEXT BEFORE ACTION",
      title: "Vardin helps you add context before you act.",
      visual: "empty",
    },
  ],
};

function Surface({ children, className = "" }) {
  return (
    <div className={"rounded-2xl border border-white/[0.12] bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.26)] backdrop-blur-md " + className}>
      {children}
    </div>
  );
}

function CallerVisual({ risk = false }) {
  return (
    <div className="relative w-[min(88vw,320px)]">
      {risk && <div className="absolute -right-12 -top-8 h-32 w-32 rounded-full bg-[#c4333c]/10 blur-3xl" />}
      <Surface className="relative overflow-hidden p-5">
        <div className="flex items-center justify-between text-[9px] font-medium tracking-[0.22em] text-white/42">
          <span>INCOMING CALL</span><span className="h-1.5 w-1.5 rounded-full bg-white/35" />
        </div>
        <div className="mt-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
            <Phone className="h-6 w-6 text-white/70" />
          </div>
          <div className="mt-4 text-lg font-medium tracking-tight text-white">Unknown caller</div>
          <div className="mt-1 text-xs text-white/42">+1 212 555 0198</div>
        </div>
        {risk ? (
          <div className="mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c4333c]/15 text-[#f26670]"><ShieldAlert className="h-4 w-4" /></div>
            <div><div className="text-xs font-medium text-white/85">Suspicious pattern</div><div className="mt-0.5 text-[10px] text-white/42">Tap for context</div></div>
            <ChevronRight className="ml-auto h-4 w-4 text-white/35" />
          </div>
        ) : <div className="mt-6 h-px bg-white/[0.08]" />}
      </Surface>
    </div>
  );
}

function SignalsVisual() {
  return (
    <div className="grid w-[min(90vw,440px)] grid-cols-3 gap-2">
      {[["72", "RISK SCORE"], ["14", "REPORTS"], ["3", "SIGNALS"]].map(([value, label], index) => (
        <Surface key={label} className="p-4 text-center">
          <div className={index === 0 ? "text-2xl font-semibold text-[#ee5964]" : "text-2xl font-semibold text-white/85"}>{value}</div>
          <div className="mt-2 text-[8px] tracking-[0.18em] text-white/38">{label}</div>
        </Surface>
      ))}
      <Surface className="col-span-3 mt-1 flex items-center gap-3 p-3.5">
        <span className="h-2 w-2 rounded-full bg-[#e94b58]" />
        <span className="text-xs text-white/68">Reported as delivery impersonation</span>
      </Surface>
    </div>
  );
}

function VerdictVisual() {
  return (
    <Surface className="w-[min(90vw,420px)] overflow-hidden">
      <div className="border-b border-white/[0.08] px-5 py-3 text-[9px] font-medium tracking-[0.2em] text-white/42">VARDIN ANALYSIS</div>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e94b58]/30 bg-[#e94b58]/10"><ShieldAlert className="h-5 w-5 text-[#f26670]" /></div>
          <div><div className="text-base font-medium text-white">High risk</div><div className="mt-1 text-xs text-white/48">Likely impersonation attempt</div></div>
          <div className="ml-auto text-2xl font-semibold text-[#f26670]">82</div>
        </div>
        <div className="mt-5 space-y-2 border-t border-white/[0.08] pt-4">
          <div className="flex justify-between text-[10px] text-white/46"><span>Caller reputation</span><span className="text-white/75">Reported</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-[82%] rounded-full bg-[#df4753]" /></div>
        </div>
      </div>
    </Surface>
  );
}

function ExplainVisual() {
  return (
    <Surface className="w-[min(90vw,430px)] p-5">
      <div className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-white/42"><Bot className="h-3.5 w-3.5 text-[#83b9c5]" /> AI EXPLANATION</div>
      <p className="mt-5 text-sm leading-6 text-white/82">The caller is creating urgency and asking you to move the conversation away from an official channel.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {["Urgency", "Impersonation", "Payment request"].map((tag) => <span key={tag} className="rounded-full border border-[#e94b58]/25 bg-[#e94b58]/[0.07] px-2.5 py-1 text-[10px] text-[#f07780]">{tag}</span>)}
      </div>
    </Surface>
  );
}

function ScanVisual() {
  return (
    <Surface className="w-[min(90vw,470px)] p-4">
      <div className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-white/42"><ScanLine className="h-3.5 w-3.5 text-[#83b9c5]" /> UNIVERSAL SCAN</div>
      <div className="mt-4 rounded-xl border border-white/[0.09] bg-black/20 p-3 text-xs leading-5 text-white/48">Your package is held. Confirm delivery details here…</div>
      <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-white/38">Message detected</span><span className="rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-medium text-white/75">Analyze</span></div>
    </Surface>
  );
}

function ImageVisual() {
  return (
    <Surface className="flex w-[min(90vw,420px)] gap-4 p-4">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1014]">
        <div className="absolute h-10 w-16 border border-[#e94b58]/45" /><ImageIcon className="h-5 w-5 text-white/35" />
      </div>
      <div className="py-1"><div className="text-xs font-medium text-white/82">Screenshot scan</div><p className="mt-2 text-[11px] leading-4 text-white/46">Checks suspicious pages, profiles, and visual cues.</p><div className="mt-3 text-[10px] text-[#83b9c5]">Image detected</div></div>
    </Surface>
  );
}

function LiveVisual() {
  return (
    <Surface className="w-[min(90vw,460px)] p-5">
      <div className="flex items-center justify-between text-[9px] tracking-[0.18em] text-white/42"><span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-[#e94b58]" /> CALL GUARD</span><span className="text-[#f07780]">LIVE</span></div>
      <div className="mt-7 flex h-12 items-center justify-center gap-1">
        {[18, 28, 12, 38, 21, 44, 25, 14, 34, 20, 29, 12, 38, 23, 16].map((height, index) => <span key={index} className={"w-1 rounded-full " + (index > 7 ? "bg-[#e94b58]/75" : "bg-[#83b9c5]/60")} style={{ height }} />)}
      </div>
      <div className="mt-6 border-t border-white/[0.08] pt-3 text-center text-[11px] text-white/55">A warning can appear while the call is still happening.</div>
    </Surface>
  );
}

function FamilyVisual() {
  return (
    <Surface className="w-[min(90vw,420px)] p-4">
      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#83b9c5]/10"><Users className="h-4 w-4 text-[#83b9c5]" /></div><div><div className="text-xs font-medium text-white/84">Family protection</div><div className="mt-0.5 text-[10px] text-white/42">Important alerts, shared with care</div></div></div>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/15 p-3"><span className="h-2 w-2 rounded-full bg-[#e94b58]" /><span className="flex-1 text-[11px] text-white/64">High-risk scan needs attention</span><ChevronRight className="h-3.5 w-3.5 text-white/35" /></div>
    </Surface>
  );
}

function IntelVisual() {
  return (
    <Surface className="w-[min(90vw,420px)] p-5">
      <div className="text-[9px] tracking-[0.2em] text-white/42">LOCAL SCAM INTELLIGENCE</div>
      <div className="mt-5 flex items-end gap-2">{[24, 46, 35, 64, 51, 78, 44, 58, 70, 39, 84].map((height, index) => <span key={index} className={index === 10 ? "w-3 rounded-t bg-[#e94b58]" : "w-3 rounded-t bg-[#83b9c5]/38"} style={{ height }} />)}</div>
      <div className="mt-4 text-xs text-white/60">Reports turn isolated moments into useful context.</div>
    </Surface>
  );
}

function SummaryVisual() {
  return <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.035] shadow-[0_0_80px_rgba(196,51,60,0.11)]"><ShieldCheck className="h-9 w-9 text-white/78" /></div>;
}

function SceneVisual({ type }) {
  const visual = {
    caller: <CallerVisual />,
    "call-risk": <CallerVisual risk />,
    signals: <SignalsVisual />,
    verdict: <VerdictVisual />,
    explain: <ExplainVisual />,
    scan: <ScanVisual />,
    image: <ImageVisual />,
    live: <LiveVisual />,
    family: <FamilyVisual />,
    intel: <IntelVisual />,
    summary: <SummaryVisual />,
    number: <div className="font-mono text-3xl tracking-[0.06em] text-white/78 sm:text-5xl">+1 212 555 0198</div>,
  }[type];

  return visual ? <motion.div initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.025, filter: "blur(8px)" }} transition={{ duration: 0.7, ease: EASE }}>{visual}</motion.div> : null;
}

export default function VardinCinematicExperience({ mode = "public", onExit, onComplete }) {
  const scenes = [...textScenes[mode], ...productScenes];
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const wheelLock = useRef(false);

  const advance = () => {
    if (index < scenes.length - 1) setIndex((value) => value + 1);
    else onComplete?.();
  };
  const retreat = () => setIndex((value) => Math.max(0, value - 1));

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") { event.preventDefault(); advance(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); retreat(); }
      if (event.key === "Escape") onExit?.();
    };
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [index]);

  const onWheel = (event) => {
    if (wheelLock.current || Math.abs(event.deltaY) < 16) return;
    wheelLock.current = true;
    event.deltaY > 0 ? advance() : retreat();
    window.setTimeout(() => { wheelLock.current = false; }, 600);
  };
  const scene = scenes[index];
  const titleParts = scene.title.split(/(<em>.*?<\/em>)/g);

  return (
    <main onWheel={onWheel} onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) distance < 0 ? advance() : retreat(); touchStart.current = null; }} className="fixed inset-0 z-[100] min-h-[100dvh] overflow-hidden bg-[#070809] font-body text-white">
      <div className="pointer-events-none absolute -left-32 top-[10%] h-[38rem] w-[38rem] rounded-full bg-[#9c2531]/[0.055] blur-[145px]" />
      <div className="pointer-events-none absolute -right-40 bottom-[-12%] h-[40rem] w-[40rem] rounded-full bg-[#247b86]/[0.05] blur-[160px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.35)_100%)]" />

      <div className="absolute right-5 top-5 z-20 flex items-center gap-3 text-[10px] font-medium tracking-[0.2em] text-white/46 sm:right-8 sm:top-8">
        <span>{String(index + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</span>
        <button onClick={onExit} className="rounded-sm border border-white/[0.14] px-2.5 py-1.5 tracking-[0.12em] text-white/62 transition hover:border-white/35 hover:text-white">SKIP <span aria-hidden="true">→</span></button>
      </div>

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pb-28 pt-16 sm:px-12">
        <AnimatePresence mode="wait">
          <motion.section key={index} initial={{ opacity: 0, y: 16, scale: 0.995, filter: "blur(5px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -12, scale: 1.01, filter: "blur(6px)" }} transition={{ duration: 0.68, ease: EASE }} className="flex w-full max-w-4xl flex-col items-center text-center">
            <div className="text-[9px] font-medium tracking-[0.32em] text-white/46 sm:text-[10px]">{scene.eyebrow}</div>
            <h1 className="mt-5 max-w-3xl text-balance font-heading text-[clamp(2.35rem,6.5vw,5.6rem)] font-medium leading-[0.98] tracking-[-0.045em] text-white">
              {titleParts.map((part, partIndex) => part.startsWith("<em>") ? <em key={partIndex} className="not-italic text-[#e45761]">{part.replace(/<\/?em>/g, "")}</em> : <React.Fragment key={partIndex}>{part}</React.Fragment>)}
            </h1>
            {scene.support && <p className="mt-5 max-w-md text-balance text-sm leading-6 text-white/48 sm:text-base">{scene.support}</p>}
            <div className="mt-9 flex min-h-[96px] items-center justify-center sm:mt-12"><SceneVisual type={scene.visual} /></div>
            {index === scenes.length - 1 && <button onClick={onComplete} className="mt-9 inline-flex items-center gap-2 rounded-sm border border-[#e45761]/60 bg-[#e45761]/10 px-4 py-2.5 text-[10px] font-medium tracking-[0.16em] text-white transition hover:bg-[#e45761]/20">{mode === "public" ? "GET STARTED" : "CONTINUE TO SETUP"} <ArrowRight className="h-3.5 w-3.5" /></button>}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-10">
        {scenes.map((_, segment) => <button key={segment} aria-label={"Go to scene " + (segment + 1)} onClick={() => setIndex(segment)} className={"h-px w-4 transition-all duration-500 sm:w-7 " + (segment === index ? "bg-[#e45761]" : "bg-white/20 hover:bg-white/45")} />)}
      </div>
      {index < scenes.length - 1 && <button onClick={advance} className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 text-[10px] tracking-[0.2em] text-white/42 transition hover:text-white sm:bottom-20">CONTINUE <span aria-hidden="true">↓</span></button>}
      <button onClick={onExit} aria-label="Close cinematic experience" className="sr-only"><X /></button>
    </main>
  );
}
