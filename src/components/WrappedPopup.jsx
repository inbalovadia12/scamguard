import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { isWrappedSeason } from "@/lib/wrappedSeason";

export default function WrappedPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isWrappedSeason()) return;
    const dismissed = localStorage.getItem("vardin_wrapped_popup_dismissed");
    if (dismissed !== new Date().getFullYear().toString()) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem("vardin_wrapped_popup_dismissed", new Date().getFullYear().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-xs animate-slide-in-right">
      <div className="relative rounded-2xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 p-5 shadow-2xl shadow-primary/30 text-white">
        <button onClick={dismiss} className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-3 pr-6">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm">Your Wrapped is Ready!</p>
            <p className="text-xs text-white/80">One week only</p>
          </div>
        </div>
        <p className="text-sm text-white/90 mb-4">
          See your year in scam protection — scans, blocked scams, top threats, and more.
        </p>
        <Link
          to="/wrapped"
          onClick={dismiss}
          className="block w-full bg-white text-primary font-semibold text-sm py-2.5 rounded-xl hover:scale-[1.02] transition-transform text-center"
        >
          View My Wrapped
        </Link>
      </div>
    </div>
  );
}