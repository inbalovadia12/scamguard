import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const STORAGE_KEY = "seen_broadcasts";
const ACTIVE_STATE_KEY = "broadcast_active_state";

const TYPE_STYLES = {
  update: { icon: "text-primary", label: "Update" },
  info: { icon: "text-chart-5", label: "Info" },
  warning: { icon: "text-warning", label: "Warning" },
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

  const dismiss = useCallback(() => {
    setSeen((prev) => {
      const allIds = broadcasts.map((b) => b.id);
      return [...new Set([...prev, ...allIds])];
    });
  }, [broadcasts]);

  return (
    <Dialog open={!!current} onOpenChange={(open) => { if (!open) dismiss(); }}>
      {current && (
        <DialogContent className="max-w-md">
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Megaphone className={`w-5 h-5 ${TYPE_STYLES[current.type]?.icon || "text-primary"}`} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {TYPE_STYLES[current.type]?.label || "Broadcast"}
              </span>
            </div>
            <DialogTitle className="text-lg">{current.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">{current.message}</DialogDescription>
          </DialogHeader>
          {current.link_url && (
            <DialogFooter className="flex-row gap-2 sm:justify-start">
              <Button asChild size="sm">
                <Link to={current.link_url} onClick={dismiss}>
                  {current.link_label || "Learn more"}
                </Link>
              </Button>
            </DialogFooter>
          )}
          <Button onClick={dismiss} variant="outline" size="sm" className="w-full">
            Got it
          </Button>
        </DialogContent>
      )}
    </Dialog>
  );
}