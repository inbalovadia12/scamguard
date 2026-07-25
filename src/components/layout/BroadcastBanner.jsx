import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";

const STYLES = {
  update: "bg-primary/10 border-primary/30 text-primary",
  info: "bg-chart-5/10 border-chart-5/30 text-chart-5",
  warning: "bg-warning/10 border-warning/30 text-warning",
};

export default function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_broadcasts") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    base44.entities.AdminBroadcast.filter({ active: true }, "-created_date", 5)
      .then(setBroadcasts)
      .catch(() => {});
  }, []);

  const visible = broadcasts.filter((b) => !dismissed.includes(b.id));
  if (visible.length === 0) return null;

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem("dismissed_broadcasts", JSON.stringify(next));
  };

  return (
    <>
      {visible.map((b) => {
        const style = STYLES[b.type] || STYLES.info;
        return (
          <div key={b.id} className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${style} text-sm`}>
            <Megaphone className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{b.title}:</span>{" "}
              <span className="opacity-90">{b.message}</span>
              {b.link_url && (
                <Link to={b.link_url} className="underline font-medium ml-1">
                  {b.link_label || "Learn more"}
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(b.id)} className="opacity-60 hover:opacity-100 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </>
  );
}