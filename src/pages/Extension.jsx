import React, { useState, useEffect } from "react";
import { Download, Puzzle, Settings2, Eye, FileText, Globe, Monitor, Lock, Loader2, ShieldCheck, Crown, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getCreditStatus } from "@/lib/credits";
import { EXTENSION_FILES, README_CONTENT } from "@/lib/extensionFiles";

const FEATURES = [
  { icon: FileText, title: "Text Analysis", desc: "Extract and analyze page text content" },
  { icon: Eye, title: "Screenshot Analysis", desc: "AI visually sees your screen" },
  { icon: Globe, title: "URL Analysis", desc: "Check domain reputation and patterns" },
  { icon: Settings2, title: "Custom Focus", desc: "Tell the AI exactly what to look for" },
];

const STEPS = [
  "Download the ZIP file using the button above",
  "Extract the ZIP into a folder named vardin-extension",
  "Open Chrome and go to chrome://extensions",
  "Enable Developer mode (toggle in the top-right corner)",
  "Click Load unpacked and select your vardin-extension folder",
  "Pin the extension to your toolbar and click it on any webpage to scan!",
];

export default function Extension() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState(null);
  const [creditStatus, setCreditStatus] = useState(null);

  useEffect(() => {
    getCreditStatus().then(setCreditStatus).catch(() => {});
  }, []);

  const isPremium = creditStatus?.isPaid;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("downloadExtension", {
        files: { ...EXTENSION_FILES, "README.txt": README_CONTENT }
      });
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      const base64 = response.data?.zip;
      if (!base64) throw new Error("No ZIP data received");

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vardin-extension.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      setError(err.message || "Download failed. Make sure you have a Premium subscription.");
    } finally {
      setDownloading(false);
    }
  };

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

      {/* Download section */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        {!isPremium ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Premium Required</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The Chrome extension is a Premium feature. Upgrade to download and use it.
              </p>
            </div>
            <Link to="/pricing">
              <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
                <Crown className="w-4 h-4" />
                Upgrade to Premium
              </Button>
            </Link>
          </div>
        ) : downloaded ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Download Complete!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Extract the ZIP and follow the installation steps below.
              </p>
            </div>
            <Button variant="outline" onClick={() => setDownloaded(false)} className="gap-2">
              <Download className="w-4 h-4" />
              Download Again
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Download Chrome Extension</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Complete extension packaged as a ZIP. Extract and load via chrome://extensions.
              </p>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Packaging...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Extension (ZIP)
                </>
              )}
            </Button>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
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
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
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
            <p className="font-medium text-foreground mb-1">Result Type — How results appear:</p>
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

      {/* Security */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "350ms" }}>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Security & Privacy
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">Uses your logged-in session — no passwords stored</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">Premium status verified server-side on every request</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">No API keys or secrets in extension files</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">Strict CSP — no inline scripts or external resources</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">HTTPS only — all communication encrypted</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">Least-privilege permissions — no broad host access</span>
          </div>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "400ms" }}>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          Installation Guide
        </h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Auth flow */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 animate-slide-up" style={{ animationDelay: "450ms" }}>
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          How Authentication Works
        </h2>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><span className="font-medium text-foreground">1.</span> Click the extension icon on any page</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">2.</span> If not logged in, click "Open Vardin Login" — it opens vardin.base44.app/login</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">3.</span> After logging in, the extension auto-detects your session (no copy-paste needed)</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">4.</span> Premium status is verified with the backend on every scan</li>
          <li className="flex gap-2"><span className="font-medium text-foreground">5.</span> If you log out of Vardin, the extension automatically detects it and prompts re-login</li>
        </ol>
      </div>
    </div>
  );
}