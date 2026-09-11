import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, X, ShieldCheck, Cookie, FileText, Database } from "lucide-react";

const SEEN_KEY = "vardin_legal_notice_seen_v1";

const links = [
  { to: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
  { to: "/cookies", label: "Cookie Policy", icon: Cookie },
  { to: "/data-collection", label: "Data Collection", icon: Database },
  { to: "/terms", label: "Terms of Service", icon: FileText },
];

export default function LegalNotice() {
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== "1") {
        setFirstVisit(true);
        setOpen(true);
      }
    } catch {
      setFirstVisit(false);
    }
  }, []);

  const dismissFirstVisit = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setFirstVisit(false);
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 sm:px-5 sm:pb-5 pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 p-4 sm:p-5 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Privacy &amp; legal notice</p>
                    <p className="mt-1 text-xs sm:text-sm leading-5 text-muted-foreground">
                      Vardin is currently in beta. By using the service, you should understand that scam checks and AI results can be inaccurate, and features such as Call Guard process submitted content through Vardin and third-party providers.
                    </p>
                  </div>
                  {!firstVisit && (
                    <button onClick={() => setOpen(false)} aria-label="Close legal information" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                  {links.map(({ to, label }) => (
                    <Link key={to} to={to} onClick={() => firstVisit && dismissFirstVisit()} className="text-primary hover:underline">
                      {label}
                    </Link>
                  ))}
                  <button onClick={dismissFirstVisit} className="ml-auto rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
                    {firstVisit ? "Got it" : "Close"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open privacy and legal information"
          title="Privacy & legal information"
          className="fixed right-4 bottom-4 z-[70] w-9 h-9 rounded-full border border-border bg-card/95 backdrop-blur shadow-lg text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-xl transition-all flex items-center justify-center"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>
      )}
    </>
  );
}
