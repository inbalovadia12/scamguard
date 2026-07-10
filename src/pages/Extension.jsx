import React from "react";
import { Download, Puzzle, Settings2, Eye, FileText, Globe, Monitor } from "lucide-react";

const EXTENSION_FILES = [
  { name: "manifest.json", url: "/chrome-extension/manifest.json", desc: "Extension configuration" },
  { name: "popup.html", url: "/chrome-extension/popup.html", desc: "Popup interface" },
  { name: "popup.js", url: "/chrome-extension/popup.js", desc: "Scanning logic" },
  { name: "styles.css", url: "/chrome-extension/styles.css", desc: "Popup styling" },
];

const FEATURES = [
  { icon: FileText, title: "Text Analysis", desc: "Extract and analyze page text content" },
  { icon: Eye, title: "Screenshot Analysis", desc: "AI visually sees your screen" },
  { icon: Globe, title: "URL Analysis", desc: "Check domain reputation and patterns" },
  { icon: Settings2, title: "Custom Focus", desc: "Tell the AI exactly what to look for" },
];

export default function Extension() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
          <Puzzle className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Vardin Chrome Extension</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
          Scan any webpage for scams with one click. AI-powered analysis that you can customize to look for exactly what matters to you.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-card rounded-2xl border border-border/50 p-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Customization options */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Customization Options
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-foreground mb-1">Scan Mode — What to look at:</p>
            <ul className="text-muted-foreground space-y-0.5 ml-4">
              <li>• <strong>Page Text</strong> — Extract and analyze the text content</li>
              <li>• <strong>Screenshot</strong> — AI visually sees your screen</li>
              <li>• <strong>Both</strong> — Text + visual analysis combined</li>
              <li>• <strong>URL Only</strong> — Check the domain and URL structure</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Answer Type — How results appear:</p>
            <ul className="text-muted-foreground space-y-0.5 ml-4">
              <li>• <strong>Quick Verdict</strong> — Yes/No + one sentence</li>
              <li>• <strong>Detailed Report</strong> — Full breakdown with risk score</li>
              <li>• <strong>Risk Score</strong> — Just a 0-100 score</li>
              <li>• <strong>Red Flags</strong> — List of specific warning signs</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Custom Focus & Instructions:</p>
            <p className="text-muted-foreground ml-4">Tell the AI exactly what to look for (e.g., "Is this a phishing site?", "Is this investment legitimate?") and add your own instructions.</p>
          </div>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          Installation Guide
        </h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">1</span>
            <span>Download all extension files below into a single folder named <code className="bg-muted px-1.5 py-0.5 rounded text-xs">vardin-extension</code></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">2</span>
            <span>Open Chrome and go to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">chrome://extensions</code></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">3</span>
            <span>Enable <strong>Developer mode</strong> (toggle in the top-right corner)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">4</span>
            <span>Click <strong>Load unpacked</strong> and select your <code className="bg-muted px-1.5 py-0.5 rounded text-xs">vardin-extension</code> folder</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">5</span>
            <span>Pin the extension to your toolbar and click it on any webpage to scan!</span>
          </li>
        </ol>
      </div>

      {/* Download files */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "400ms" }}>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          Extension Files
        </h2>
        <p className="text-xs text-muted-foreground">Right-click each link and choose "Save link as..." to download. Save all files into the same folder.</p>
        <div className="grid gap-2">
          {EXTENSION_FILES.map((file) => (
            <a
              key={file.name}
              href={file.url}
              download
              className="flex items-center justify-between bg-card rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-all group"
            >
              <div>
                <p className="font-medium text-sm font-mono">{file.name}</p>
                <p className="text-xs text-muted-foreground">{file.desc}</p>
              </div>
              <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}