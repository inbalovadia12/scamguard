import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Bot, ChevronRight, Image as ImageIcon, Phone, Radio,
  ScanLine, ShieldAlert, ShieldCheck, Users, X,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];

function TypingTitle({ text }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    const timer = window.setInterval(() => {
      setVisible((value) => {
        if (value >= text.length) {
          window.clearInterval(timer);
          return value;
        }
        return value + 1;
      });
    }, 52);
    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <span className="relative inline">
      {text.slice(0, visible)}
      <motion.span
        aria-hidden="true"
        className="ml-1 inline-block h-[0.8em] w-[2px] translate-y-[0.08em] bg-[#e45761] align-baseline"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );
}

const productScenes = [
  { eyebrow: "AI ASSISTANT", title: "When something feels off, ask Vardin.", support: "A calm AI guide helps you understand the situation, choose your next move, and know what not to do.", visual: "assistant" },
  { eyebrow: "SCAM EXPOSER", title: "See the tactic, not just the warning.", support: "Vardin breaks down urgency, impersonation, manipulation, and payment pressure so the scam becomes obvious.", visual: "exposer" },
  { eyebrow: "BROWSER EXTENSION", title: "Check the web while you browse.", support: "Bring Vardin into the page you are already looking at and get context before you click, pay, or sign in.", visual: "browser" },
  { eyebrow: "PHONE GUARD", title: "Know who is calling before you react.", support: "Phone Guard puts caller context and risk signals beside the moment they matter.", visual: "phone" },
  { eyebrow: "RECOVERY HELP", title: "If you already acted, start here.", support: "Vardin helps you move from panic to a practical recovery plan: secure, report, document, and recover.", visual: "recovery" },
  { eyebrow: "UNIVERSAL SCANNER", title: "One place to check the things you receive.", support: "Messages, links, numbers, screenshots, images, and crypto requests can all be checked before you act.", visual: "universal" },
  { eyebrow: "LESSONS", title: "Protection gets stronger when you learn the pattern.", support: "Short, focused lessons turn real scam tactics into instincts you can recognize next time.", visual: "lessons" },
  { eyebrow: "LOCAL SCAM INTELLIGENCE", title: "Know what is happening around you.", support: "Local reports surface the scams, impersonations, and patterns appearing in your area.", visual: "local" },
  { eyebrow: "COMMUNITY", title: "Your experience can protect the next person.", support: "Report what you found, learn from other people, and turn isolated scams into shared intelligence.", visual: "community" },
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

function AssistantVisual() {
  return (
    <Surface className="w-[min(92vw,470px)] overflow-hidden p-4 text-left">
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3"><Bot className="h-4 w-4 text-[#83b9c5]" /><span className="text-[9px] tracking-[0.18em] text-white/45">VARDIN AI</span><span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#83b9c5]" /></div>
      <div className="space-y-3 py-4">
        <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-sm bg-white/[0.08] px-3 py-2 text-[11px] leading-5 text-white/68">They say my account will be closed today. Is this real?</div>
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.6 }} className="max-w-[84%] rounded-2xl rounded-bl-sm border border-[#83b9c5]/15 bg-[#83b9c5]/[0.06] px-3 py-2 text-[11px] leading-5 text-white/75">That urgency is a warning sign. Don't use their link. Let's check the sender and decide what to do next.</motion.div>
      </div>
      <div className="flex items-center gap-2 border-t border-white/[0.08] pt-3 text-[9px] text-white/35"><span className="h-1.5 w-1.5 rounded-full bg-[#83b9c5] animate-pulse" /> THINKING WITH YOU</div>
    </Surface>
  );
}

function ExposerVisual() {
  const tactics = ["URGENT DEADLINE", "IMPERSONATION", "MOVE OFFICIAL CHANNEL", "PAYMENT PRESSURE"];
  return (
    <div className="relative w-[min(92vw,470px)]">
      <motion.div animate={{ rotate: [0, -1, 1, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
        <Surface className="p-5 text-left">
          <div className="flex items-center justify-between"><span className="text-[9px] tracking-[0.2em] text-white/40">SCAM EXPOSER</span><span className="rounded-full bg-[#e94b58]/10 px-2 py-1 text-[8px] tracking-[0.14em] text-[#f07780]">4 TACTICS</span></div>
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4 text-[11px] leading-5 text-white/58">“Act now or your account will be permanently suspended.”</div>
          <div className="mt-4 grid grid-cols-2 gap-2">{tactics.map((t, i) => <motion.div key={t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.1 }} className="rounded-lg border border-[#e94b58]/15 bg-[#e94b58]/[0.05] p-2.5 text-[8px] tracking-[0.08em] text-[#f07780]">{t}</motion.div>)}</div>
        </Surface>
      </motion.div>
    </div>
  );
}

function BrowserVisual() {
  return (
    <Surface className="w-[min(94vw,520px)] overflow-hidden text-left">
      <div className="flex items-center gap-1.5 border-b border-white/[0.08] bg-white/[0.025] px-3 py-2"><span className="h-1.5 w-1.5 rounded-full bg-white/20" /><span className="h-1.5 w-1.5 rounded-full bg-white/20" /><span className="h-1.5 w-1.5 rounded-full bg-white/20" /><div className="ml-3 flex-1 rounded-md bg-black/25 px-3 py-1.5 text-[8px] text-white/32">example-login-security.com</div><span className="text-[8px] text-[#e94b58]">V</span></div>
      <div className="relative h-36 overflow-hidden bg-white/[0.018] p-5"><div className="h-3 w-28 rounded bg-white/10" /><div className="mt-4 h-2 w-52 rounded bg-white/[0.06]" /><div className="mt-2 h-2 w-40 rounded bg-white/[0.06]" /><motion.div initial={{ x: 70, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.35, duration: 0.7, ease: EASE }} className="absolute right-4 top-5 w-40 rounded-xl border border-[#e94b58]/25 bg-[#110b0d]/95 p-3 shadow-2xl"><div className="text-[8px] tracking-[0.16em] text-[#f07780]">VARDIN WARNING</div><div className="mt-2 text-[10px] text-white/75">Possible impersonation</div><div className="mt-1 text-[8px] text-white/35">Check before signing in.</div></motion.div></div>
    </Surface>
  );
}

function PhoneGuardVisual() {
  return (
    <div className="relative w-[min(88vw,340px)]">
      <motion.div animate={{ y: [0, -5, 0], rotate: [0, 0.5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
        <Surface className="overflow-hidden p-5">
          <div className="flex items-center justify-between text-[9px] tracking-[0.18em] text-white/40"><span>PHONE GUARD</span><span className="text-[#83b9c5]">PROTECTED</span></div>
          <div className="mt-7 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]"><Phone className="h-6 w-6 text-white/65" /></div><div className="mt-4 text-sm text-white/80">Unknown caller</div><div className="mt-1 font-mono text-[10px] text-white/35">+1 212 555 0198</div></div>
          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.5, duration: 0.8 }} className="mt-6 h-px bg-gradient-to-r from-transparent via-[#e94b58]/60 to-transparent" />
          <div className="mt-4 flex items-center gap-2 text-[9px] text-white/48"><ShieldAlert className="h-3.5 w-3.5 text-[#f07780]" /> Risk context available</div>
        </Surface>
      </motion.div>
    </div>
  );
}

function RecoveryVisual() {
  const steps = ["Secure accounts", "Report the scam", "Save evidence", "Start recovery"];
  return <Surface className="w-[min(92vw,440px)] p-5 text-left"><div className="text-[9px] tracking-[0.2em] text-white/40">RECOVERY HELP</div><div className="mt-5 space-y-3">{steps.map((step, i) => <motion.div key={step} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[9px] text-white/50">{i + 1}</div><span className="text-[11px] text-white/68">{step}</span><motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.12, type: "spring" }} className="ml-auto text-[#83b9c5]">✓</motion.span></motion.div>)}</div></Surface>;
}

function UniversalVisual() {
  const types = [["MSG", "message"], ["IMG", "image"], ["CRYPTO", "wallet"], ["LINK", "web"]];
  return <div className="grid w-[min(92vw,500px)] grid-cols-2 gap-2 sm:grid-cols-4">{types.map(([label, sub], i) => <motion.div key={label} initial={{ opacity: 0, y: 20, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.1, duration: 0.55, ease: EASE }}><Surface className="h-24 p-3 text-left"><div className="flex h-full flex-col justify-between"><ScanLine className="h-4 w-4 text-[#83b9c5]" /><div><div className="text-[10px] font-medium text-white/75">{label}</div><div className="mt-0.5 text-[8px] text-white/30">{sub}</div></div></Surface></div>)}</div>;
}

function LessonsVisual() {
  return <Surface className="w-[min(92vw,440px)] p-4 text-left"><div className="flex items-center justify-between"><span className="text-[9px] tracking-[0.2em] text-white/40">LESSON 04</span><span className="text-[9px] text-[#83b9c5]">3 MIN</span></div><div className="mt-5 text-base text-white/82">Can you spot the pressure tactic?</div><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.08]"><motion.div initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ delay: 0.4, duration: 1 }} className="h-full rounded-full bg-[#83b9c5]" /></div><div className="mt-4 flex gap-2"><span className="rounded-lg border border-[#e94b58]/20 bg-[#e94b58]/[0.05] px-3 py-2 text-[9px] text-[#f07780]">Urgency</span><span className="rounded-lg border border-white/10 px-3 py-2 text-[9px] text-white/42">Normal request</span></div></Surface>;
}

function LocalVisual() {
  return <Surface className="relative w-[min(92vw,470px)] overflow-hidden p-5"><div className="text-[9px] tracking-[0.2em] text-white/40">LOCAL SCAM INTELLIGENCE</div><div className="relative mt-5 h-28 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0d0f]"><div className="absolute inset-0 opacity-40 [background-image:linear-gradient(30deg,transparent_48%,rgba(131,185,197,0.14)_49%,transparent_50%),linear-gradient(120deg,transparent_48%,rgba(255,255,255,0.07)_49%,transparent_50%)] [background-size:42px_42px]" />{[[24,28],[58,54],[72,32],[42,76],[82,68]].map(([x,y], i) => <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ delay: i * 0.16, duration: 0.6 }} className="absolute h-2.5 w-2.5 rounded-full bg-[#e94b58] shadow-[0_0_18px_rgba(228,87,97,0.55)]" style={{ left: `${x}%`, top: `${y}%` }} />)}</div><div className="mt-3 text-[10px] text-white/42">New reports are changing the local pattern.</div></Surface>;
}

function CommunityVisual() {
  const posts = [["Maya", "Fake delivery text using a local courier name"], ["Daniel", "Investment group asking for crypto deposit"], ["Noa", "Caller claiming to be from the bank"]];
  return <Surface className="w-[min(92vw,460px)] p-4 text-left"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#83b9c5]" /><span className="text-[9px] tracking-[0.18em] text-white/40">COMMUNITY REPORTS</span></div><div className="mt-4 space-y-2">{posts.map(([name, text], i) => <motion.div key={name} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.14 }} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[9px] text-white/50">{name[0]}</div><div><div className="text-[9px] text-white/35">{name}</div><div className="mt-1 text-[10px] leading-4 text-white/62">{text}</div></div></motion.div>)}</div></Surface>;
}

function SceneVisual({ type }) {
  const visual = {
    assistant: <AssistantVisual />,
    exposer: <ExposerVisual />,
    browser: <BrowserVisual />,
    phone: <PhoneGuardVisual />,
    recovery: <RecoveryVisual />,
    universal: <UniversalVisual />,
    lessons: <LessonsVisual />,
    local: <LocalVisual />,
    community: <CommunityVisual />,
    number: <div className="font-mono text-3xl tracking-[0.06em] text-white/78 sm:text-5xl">+1 212 555 0198</div>,
  }[type];

  return visual ? <motion.div initial={{ opacity: 0, x: 90, y: 24, scale: 0.92, rotate: 1.5, filter: "blur(10px)" }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -80, y: -16, scale: 1.03, rotate: -1.5, filter: "blur(8px)" }} transition={{ duration: 0.95, ease: EASE, delay: 0.2 }}>{visual}</motion.div> : null;
}

export default function VardinCinematicExperience({ mode = "public", onExit, onComplete, completionLabel }) {
  const scenes = [...textScenes[mode], ...productScenes];
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const wheelLock = useRef(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

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

  useEffect(() => {
    const reduced = document.documentElement.classList.contains("reduced-motion");
    if (reduced || index >= scenes.length - 1) return;
    const timer = window.setTimeout(() => setIndex((value) => Math.min(value + 1, scenes.length - 1)), 9000);
    return () => window.clearTimeout(timer);
  }, [index, scenes.length]);

  const onWheel = (event) => {
    if (wheelLock.current || Math.abs(event.deltaY) < 16) return;
    wheelLock.current = true;
    event.deltaY > 0 ? advance() : retreat();
    window.setTimeout(() => { wheelLock.current = false; }, 600);
  };
  const scene = scenes[index];
  const titleParts = scene.title.split(/(<em>.*?<\/em>)/g);
  const plainTitle = titleParts.map((part) => part.replace(/<\/?em>/g, "")).join("");

  return (
    <main
      onWheel={onWheel}
      onMouseMove={(event) => setPointer({ x: (event.clientX / window.innerWidth - 0.5) * 2, y: (event.clientY / window.innerHeight - 0.5) * 2 })}
      onMouseLeave={() => setPointer({ x: 0, y: 0 })}
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }}
      onTouchEnd={(event) => { if (touchStart.current === null) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) distance < 0 ? advance() : retreat(); touchStart.current = null; }}
      className="fixed inset-0 z-[100] min-h-[100dvh] overflow-hidden bg-[#070809] font-body text-white"
    >
      <motion.div
        className="pointer-events-none absolute -left-32 top-[10%] h-[38rem] w-[38rem] rounded-full bg-[#9c2531]/[0.055] blur-[145px]"
        animate={{ x: pointer.x * 24, y: pointer.y * 18, scale: [1, 1.08, 1] }}
        transition={{ x: { duration: 1.2 }, y: { duration: 1.2 }, scale: { duration: 7, repeat: Infinity, ease: "easeInOut" } }}
      />
      <motion.div
        className="pointer-events-none absolute -right-40 bottom-[-12%] h-[40rem] w-[40rem] rounded-full bg-[#247b86]/[0.05] blur-[160px]"
        animate={{ x: pointer.x * -18, y: pointer.y * -14, scale: [1.05, 1, 1.05] }}
        transition={{ x: { duration: 1.4 }, y: { duration: 1.4 }, scale: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.35)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.5)_0.7px,transparent_0.8px)] [background-size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)] animate-[drift-grid_18s_linear_infinite]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="absolute right-5 top-5 z-20 flex items-center gap-3 text-[10px] font-medium tracking-[0.2em] text-white/46 sm:right-8 sm:top-8">
        <span>{String(index + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</span>
        <button onClick={onExit} className="rounded-sm border border-white/[0.14] px-2.5 py-1.5 tracking-[0.12em] text-white/62 transition hover:border-white/35 hover:text-white">SKIP <span aria-hidden="true">→</span></button>
      </div>

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pb-28 pt-16 sm:px-12">
        <AnimatePresence mode="wait">
          <motion.section key={index} initial={{ opacity: 0, y: 28, scale: 0.985, filter: "blur(7px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -30, scale: 1.02, filter: "blur(7px)" }} transition={{ duration: 0.82, ease: EASE }} className="flex w-full max-w-4xl flex-col items-center text-center">
            <motion.div initial={{ opacity: 0, y: 12, letterSpacing: "0.5em" }} animate={{ opacity: 1, y: 0, letterSpacing: "0.32em" }} transition={{ duration: 0.65, ease: EASE }} className="text-[9px] font-medium tracking-[0.32em] text-white/46 sm:text-[10px]">{scene.eyebrow}</motion.div>
            <motion.h1
              className="mt-5 max-w-3xl text-balance font-heading text-[clamp(2.35rem,6.5vw,5.6rem)] font-medium leading-[0.98] tracking-[-0.045em] text-white"
              style={{ x: pointer.x * 3, y: pointer.y * 2 }}
              transition={{ type: "spring", stiffness: 90, damping: 20 }}
            >
              {scene.title.includes("<em>") ? (
                titleParts.map((part, partIndex) => part.startsWith("<em>")
                  ? <em key={partIndex} className="not-italic text-[#e45761]"><TypingTitle text={part.replace(/<\/?em>/g, "")} /></em>
                  : <React.Fragment key={partIndex}><TypingTitle text={part} /></React.Fragment>)
              ) : <TypingTitle text={plainTitle} />}
            </motion.h1>
            {scene.support && <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5, ease: EASE }} className="mt-5 max-w-md text-balance text-sm leading-6 text-white/48 sm:text-base">{scene.support}</motion.p>}
            <motion.div
              className="mt-9 flex min-h-[96px] items-center justify-center sm:mt-12"
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.7, ease: EASE }}
            >
              <SceneVisual type={scene.visual} />
            </motion.div>
            {index === scenes.length - 1 && <button onClick={onComplete} className="mt-9 inline-flex items-center gap-2 rounded-sm border border-[#e45761]/60 bg-[#e45761]/10 px-4 py-2.5 text-[10px] font-medium tracking-[0.16em] text-white transition hover:bg-[#e45761]/20">{completionLabel || (mode === "public" ? "GET STARTED" : "CONTINUE TO SETUP")} <ArrowRight className="h-3.5 w-3.5" /></button>}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-10">
        {scenes.map((_, segment) => <button key={segment} aria-label={"Go to scene " + (segment + 1)} onClick={() => setIndex(segment)} className={"relative h-px w-4 overflow-hidden bg-white/20 transition-all duration-500 sm:w-7 " + (segment === index ? "sm:w-12" : "hover:bg-white/45")}>
          {segment === index && <motion.span className="absolute inset-y-0 left-0 bg-[#e45761]" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 8.8, ease: "linear" }} />}
        </button>)}
      </div>
      {index < scenes.length - 1 && <motion.button onClick={advance} animate={{ opacity: [0.42, 0.85, 0.42], y: [0, 3, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 text-[10px] tracking-[0.2em] text-white/42 transition hover:text-white sm:bottom-20">CONTINUE <span aria-hidden="true">↓</span></motion.button>}
      <button onClick={onExit} aria-label="Close cinematic experience" className="sr-only"><X /></button>
    </main>
  );
}
