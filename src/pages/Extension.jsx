import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Download, Puzzle, Chrome, Loader2, ShieldCheck, FlaskConical } from "lucide-react";
import { getCreditStatus } from "@/lib/credits";
import { Link } from "react-router-dom";

const EXTENSION_URL = "https://media.base44.com/files/public/6a46a8e315996af6f0443792/5b46f19dc_verinta_extension1.zip";

const installSteps = [
  { title: "Download the extension", desc: "Click the download button above to get the Vardin extension ZIP file to your computer." },
  { title: "Extract the ZIP file", desc: "Right-click the downloaded ZIP file and select 'Extract All' (Windows) or double-click it (Mac). Remember the folder location." },
  { title: "Open Chrome extensions page", desc: "Open Google Chrome and type chrome://extensions/ in your address bar, then press Enter." },
  { title: "Enable Developer Mode", desc: "Look for the 'Developer mode' toggle in the top-right corner of the extensions page and turn it ON." },
  { title: "Load the unpacked extension", desc: "Click the 'Load unpacked' button. Select the folder you extracted in Step 2 (the one containing manifest.json)." },
  { title: "Pin Vardin to your toolbar", desc: "Click the puzzle piece icon in Chrome's top toolbar, then click the pin icon next to Vardin to keep it visible." },
  { title: "Start protecting your family", desc: "The extension is now active! Right-click any suspicious message and analyze it instantly with Vardin." },
];

export default function Extension() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCreditStatus().then((c) => { setCredits(c); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!credits?.isPremium) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-warning/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Premium Feature</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The Vardin Chrome Extension is available for paid plan subscribers.
            Upgrade to download the extension and protect yourself in real-time.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              <ShieldCheck className="w-4 h-4" />
              Upgrade Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Puzzle className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight font-heading">Vardin Chrome Extension</h1>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-warning/15 text-warning">
            <FlaskConical className="w-3 h-3" />
            Beta
          </span>
        </div>
        <p className="text-muted-foreground">Real-time scam protection right in your browser.</p>
      </div>

      <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-2xl border border-primary/20 p-6 text-center space-y-3">
        <Download className="w-10 h-10 text-primary mx-auto" />
        <h2 className="font-semibold text-lg font-heading">Download Extension</h2>
        <p className="text-sm text-muted-foreground">Get the Vardin browser extension ZIP file.</p>
        <a href={EXTENSION_URL} download>
          <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
            <Download className="w-4 h-4" />
            Download ZIP
          </Button>
        </a>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Chrome className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg font-heading">Installation Guide</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Follow these steps to install the Vardin extension using Chrome's Developer Mode:
        </p>
        <div className="space-y-4">
          {installSteps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {i + 1}
              </div>
              <div className="space-y-1 pt-1">
                <h3 className="font-medium text-sm">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}