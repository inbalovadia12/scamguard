import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

const THEMES = {
  identity: {
    title: "Scanning Your Identity",
    gradient: "from-violet-500 via-primary to-cyan-500",
    estimatedDuration: 50000,
    steps: [
      { label: "Connecting to search networks...", at: 0 },
      { label: "Searching data broker databases...", at: 8 },
      { label: "Scanning people search sites...", at: 20 },
      { label: "Checking public records...", at: 35 },
      { label: "Analyzing social media exposure...", at: 50 },
      { label: "Cross-referencing 15+ data brokers...", at: 65 },
      { label: "Identifying exposed personal info...", at: 78 },
      { label: "Compiling your exposure report...", at: 88 },
      { label: "Finalizing results...", at: 95 },
    ],
  },
  negotiator: {
    title: "Crafting Your Questions",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 18000,
    steps: [
      { label: "Analyzing the situation...", at: 0 },
      { label: "Identifying scam patterns...", at: 15 },
      { label: "Researching common tactics...", at: 30 },
      { label: "Generating targeted questions...", at: 45 },
      { label: "Crafting red flag responses...", at: 65 },
      { label: "Refining for maximum impact...", at: 80 },
      { label: "Finalizing your questions...", at: 92 },
    ],
  },
  scanner: {
    title: "Deep Scanning Content",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 25000,
    steps: [
      { label: "Processing input content...", at: 0 },
      { label: "Fetching webpage data...", at: 12 },
      { label: "Checking VirusTotal reputation...", at: 25 },
      { label: "Analyzing for phishing patterns...", at: 40 },
      { label: "Detecting manipulation tactics...", at: 55 },
      { label: "Cross-referencing scam databases...", at: 70 },
      { label: "Evaluating risk factors...", at: 85 },
      { label: "Compiling your report...", at: 93 },
    ],
  },
  image: {
    title: "Analyzing Image",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 20000,
    steps: [
      { label: "Processing uploaded image...", at: 0 },
      { label: "Extracting visual features...", at: 15 },
      { label: "Searching for similar images online...", at: 30 },
      { label: "Checking scam profile databases...", at: 45 },
      { label: "Analyzing photo patterns...", at: 60 },
      { label: "Cross-referencing reverse image search...", at: 75 },
      { label: "Identifying red flags...", at: 88 },
      { label: "Compiling risk assessment...", at: 95 },
    ],
  },
  phone: {
    title: "Looking Up Phone Number",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 18000,
    steps: [
      { label: "Identifying carrier and country...", at: 0 },
      { label: "Searching scam report databases...", at: 15 },
      { label: "Checking user-reported numbers...", at: 30 },
      { label: "Cross-referencing known scam lists...", at: 50 },
      { label: "Analyzing call patterns...", at: 65 },
      { label: "Checking reputation services...", at: 80 },
      { label: "Compiling number reputation...", at: 92 },
    ],
  },
  local: {
    title: "Scanning Local Scam Activity",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 25000,
    steps: [
      { label: "Locating your area...", at: 0 },
      { label: "Searching local scam reports...", at: 12 },
      { label: "Researching common scams...", at: 28 },
      { label: "Analyzing seasonal patterns...", at: 45 },
      { label: "Checking current trending scams...", at: 60 },
      { label: "Finding local reporting resources...", at: 75 },
      { label: "Compiling local intelligence report...", at: 90 },
    ],
  },
  message: {
    title: "Analyzing Message",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 12000,
    steps: [
      { label: "Processing message content...", at: 0 },
      { label: "Identifying message type...", at: 15 },
      { label: "Detecting manipulation tactics...", at: 30 },
      { label: "Checking for urgency & pressure...", at: 45 },
      { label: "Analyzing sender intent...", at: 60 },
      { label: "Cross-referencing scam patterns...", at: 75 },
      { label: "Compiling risk assessment...", at: 90 },
    ],
  },
  url: {
    title: "Scanning Link",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 15000,
    steps: [
      { label: "Fetching website content...", at: 0 },
      { label: "Analyzing page structure...", at: 15 },
      { label: "Checking domain reputation...", at: 30 },
      { label: "Detecting phishing indicators...", at: 50 },
      { label: "Cross-referencing scam databases...", at: 70 },
      { label: "Evaluating risk factors...", at: 85 },
      { label: "Compiling scan report...", at: 95 },
    ],
  },
  default: {
    title: "Processing",
    gradient: "from-primary to-primary/80",
    estimatedDuration: 15000,
    steps: [
      { label: "Processing your request...", at: 0 },
      { label: "Analyzing data...", at: 25 },
      { label: "Cross-referencing sources...", at: 50 },
      { label: "Compiling results...", at: 75 },
      { label: "Finalizing...", at: 92 },
    ],
  },
};

export default function LongLoadingScreen({ type = "default" }) {
  const theme = THEMES[type] || THEMES.default;
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      setElapsed(elapsedMs);

      let pct;
      if (elapsedMs < theme.estimatedDuration) {
        const ratio = elapsedMs / theme.estimatedDuration;
        pct = Math.min(90, (1 - Math.pow(1 - ratio, 2)) * 90);
      } else {
        const overtime = elapsedMs - theme.estimatedDuration;
        pct = Math.min(95, 90 + overtime / 2000);
      }
      setProgress(pct);
    }, 100);

    return () => clearInterval(interval);
  }, [theme.estimatedDuration]);

  const currentStep = [...theme.steps].reverse().find((s) => progress >= s.at) || theme.steps[0];
  const pctRounded = Math.round(progress);
  const elapsedSeconds = Math.floor(elapsed / 1000);
  const remainingSeconds = Math.max(0, Math.ceil(theme.estimatedDuration / 1000 - elapsedSeconds));

  return (
    <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 sm:p-8 flex flex-col items-center gap-5 animate-fade-in">
      {/* Circular progress with percentage */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl sm:text-2xl font-bold font-heading">{pctRounded}%</span>
        </div>
      </div>

      {/* Title and current step */}
      <div className="text-center space-y-1.5">
        <p className="text-sm sm:text-base font-semibold font-heading">{theme.title}</p>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {currentStep.label}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full space-y-1.5">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{elapsedSeconds}s elapsed</span>
          <span>~{remainingSeconds}s remaining</span>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/20">
        <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
        <p className="text-xs text-warning font-medium">Do not switch tabs or close this page while processing.</p>
      </div>
    </div>
  );
}