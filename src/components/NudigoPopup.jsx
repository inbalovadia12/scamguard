import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, TrendingDown } from "lucide-react";

const STORAGE_KEY = "vardin_nudigo_popup";
const DISMISS_KEY = "vardin_nudigo_dismissed";
const SHOW_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
const INITIAL_DELAY = 15000; // 15 seconds after page load

export default function NudigoPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed) return;

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const last = JSON.parse(raw).lastShown;
          if (Date.now() - last < SHOW_INTERVAL) return;
        }
        setVisible(true);
      } catch {}
    }, INITIAL_DELAY);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastShown: Date.now() }));
    } catch {}
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
  };

  const handleVisit = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
    window.open("https://nudigofinance.base44.app", "_blank");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-slide-in-right">
      <div className="bg-card rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <img
              src="https://media.base44.com/images/public/6a46a8e315996af6f0443792/7646e1e11_generated_image.png"
              alt="Nudigo"
              className="w-12 h-12 rounded-xl object-cover shadow-md"
            />
            <div>
              <h3 className="font-semibold text-sm">Try Nudigo</h3>
              <p className="text-xs text-muted-foreground">Smart finance habits</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Build better money habits and stop impulse purchases with Nudigo — your personalized finance companion.
          </p>
        </div>
        <div className="flex items-center gap-2 p-5 pt-3">
          <Button onClick={handleVisit} className="flex-1 gap-2 bg-gradient-to-r from-green-500 to-teal-500 hover:opacity-90">
            Try Nudigo
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs text-muted-foreground">
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}