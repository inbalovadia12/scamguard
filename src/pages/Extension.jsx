import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Download, Puzzle, Chrome, Loader2, Shield } from "lucide-react";
import { getCreditStatus } from "@/lib/credits";
import { Link } from "react-router-dom";

const EXTENSION_URL = "https://media.base44.com/files/public/6a46a8e315996af6f0443792/5b46f19dc_verinta_extension1.zip";

const installSteps = [
  {
    title: "Download the extension",
    desc: "Click the download button above to get the ScamGuard extension ZIP file to your computer.",
  },
  {
    title: "Extract the ZIP file",
    desc: "Right-click the downloaded ZIP file and select 'Extract All' (Windows) or double-click it (Mac). Remember the folder location where you extracted it.",
  },
  {
    title: "Open Chrome extensions page",
    desc: "Open Google Chrome and type chrome://extensions/ in your address bar, then press Enter.",
  },
  {
    title: "Enable Developer Mode",
    desc: "Look for the 'Developer mode' toggle in the top-right corner of the extensions page and turn it ON.",
  },
  {
    title: "Load the unpacked extension",
    desc: "Click the 'Load unpacked' button that appears. Select the folder you extracted in Step 2 (the one containing the manifest.json file).",
  },
  {
    title: "Pin ScamGuard to your toolbar",
    desc: "Click the puzzle piece icon in Chrome's top toolbar, then click the pin icon next to ScamGuard to keep it visible.",
  },
  {
    title: "Start protecting your family",
    desc: "The extension is now active! It will help analyze suspicious content as you browse. Forward any suspicious messages to ScamGuard for instant AI-powered analysis.",
  },
];

export default function Extension() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCreditStatus().then((c) => {
      setCredits(c);
      setLoading(false);
    });
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
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Premium Feature</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The ScamGuard Chrome Extension is available exclusively for Family Plan subscribers.
            Upgrade to download the extension and protect your family in real-time.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600">
              <Shield className="w-4 h-4" />
              Upgrade to Premium
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Puzzle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ScamGuard Chrome Extension</h1>
        <p className="text-muted-foreground">Real-time scam protection right in your browser.</p>
      </div>

      {/* Download */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl border border-blue-100 p-6 text-center space-y-3">
        <Download className="w-10 h-10 text-blue-500 mx-auto" />
        <h2 className="font-semibold text-lg">Download Extension</h2>
        <p className="text-sm text-muted-foreground">Get the ScamGuard browser extension ZIP file.</p>
        <a href={EXTENSION_URL} download>
          <Button className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600">
            <Download className="w-4 h-4" />
            Download ZIP
          </Button>
        </a>
      </div>

      {/* Installation Guide */}
      <div className="bg-white rounded-2xl border border-border/50 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Chrome className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-lg">Installation Guide</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Follow these steps to install the ScamGuard extension using Chrome's Developer Mode:
        </p>
        <div className="space-y-4">
          {installSteps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
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