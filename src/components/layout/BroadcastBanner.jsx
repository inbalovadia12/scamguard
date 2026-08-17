import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const TYPE_STYLES = {
  update: { icon: "text-primary", label: "Update" },
  info: { icon: "text-chart-5", label: "Info" },
  warning: { icon: "text-warning", label: "Warning" },
};

export default function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [seen, setSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem("seen_broadcasts") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    base44.entities.AdminBroadcast.filter({ active: true }, "-created_date", 10)
      .then(setBroadcasts)
      .catch(() => {});
  }, []);

  const unseen = broadcasts.filter((b) => !seen.includes(b.id));
  const current = unseen[0];

  const dismiss = () => {
    // Mark ALL currently active broadcasts as seen — prevents the same alert
    // or queued alerts from reappearing after "Got it" is clicked.
    setSeen((prev) => {
      const allIds = broadcasts.map((b) => b.id);
      const next = [...new Set([...prev, ...allIds])];
      localStorage.setItem("seen_broadcasts", JSON.stringify(next));
      return next;
    });
  };

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