import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "seen_broadcasts";
const ACTIVE_STATE_KEY = "broadcast_active_state";

const TYPE_STYLES = {
  update: { icon: "text-primary", label: "Update", ring: "border-primary/30 bg-primary/5" },
  info: { icon: "text-chart-5", label: "Info", ring: "border-border bg-card" },
  warning: { icon: "text-warning", label: "Warning", ring: "border-warning/30 bg-warning/5" },
};

function readSeen() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function readActiveState() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_STATE_KEY) || "{}"); } catch { return {}; }
}

export default function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [seen, setSeen] = useState(readSeen);

  const loadBroadcasts = useCallback(async () => {
    try {
      // Fetch all records so we can detect an inactive → active transition.
      // Deactivation therefore hides a broadcast immediately, while reactivation
      // intentionally makes it eligible to appear again even if it was dismissed before.
      const all = await base44.entities.AdminBroadcast.list("-created_date", 50);
      const activeState = readActiveState();
      let nextSeen = readSeen();
      let stateChanged = false;

      for (const broadcast of all || []) {
        const wasActive = activeState[broadcast.id];
        if (wasActive === false && broadcast.active === true) {
          nextSeen = nextSeen.filter((id) => id !== broadcast.id);
          stateChanged = true;
        }
        activeState[broadcast.id] = !!broadcast.active;
      }

      try { localStorage.setItem(ACTIVE_STATE_KEY, JSON.stringify(activeState)); } catch {}
      if (stateChanged) setSeen(nextSeen);
      setBroadcasts((all || []).filter((broadcast) => broadcast.active));
    } catch {}
  }, []);

  useEffect(() => {
    loadBroadcasts();
    // Keep the banner in sync if an admin deactivates a broadcast while a user is online.
    const interval = window.setInterval(loadBroadcasts, 10000);
    return () => window.clearInterval(interval);
  }, [loadBroadcasts]);

  // Persist seen IDs to localStorage whenever they change (kept outside the
  // state updater so React strict-mode double-invocation can't skip the write).
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seen)); } catch {}
  }, [seen]);

  const unseen = broadcasts.filter((b) => !seen.includes(b.id));
  const current = unseen[0];

  // Non-blocking dismissible banner (not a modal). A modal overlay would sit
  // above the sidebar nav and swallow the first nav click (forcing a double
  // click), so we render inline inside the content area instead.
  const dismiss = useCallback(() => {
    setSeen((prev) => {
      const allIds = broadcasts.map((b) => b.id);
      return [...new Set([...prev, ...allIds])];
    });
  }, [broadcasts]);

  if (!current) return null;

  const style = TYPE_STYLES[current.type] || TYPE_STYLES.info;

  return (
    <div className={`relative rounded-2xl border p-4 sm:p-5 shadow-sm animate-slide-up ${style.ring}`}>
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2.5 mb-1.5 pr-8">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Megaphone className={`w-4.5 h-4.5 ${style.icon}`} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {style.label}
        </span>
      </div>
      <h3 className="text-sm font-semibold pr-6">{current.title}</h3>
      {current.message && (
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{current.message}</p>
      )}
      {current.link_url && (
        <Button asChild size="sm" className="mt-3">
          <Link to={current.link_url} onClick={dismiss}>
            {current.link_label || "Learn more"}
          </Link>
        </Button>
      )}
    </div>
  );
}