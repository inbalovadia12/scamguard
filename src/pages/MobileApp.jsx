import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Smartphone, Bell, ShieldCheck, PhoneCall, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";

const FEATURES = [
  { icon: PhoneCall, title: "Live Call Guard", desc: "Real-time scam coaching during phone calls, on-device." },
  { icon: Bell, title: "Push Alerts", desc: "Family threat alerts delivered straight to your phone." },
  { icon: ShieldCheck, title: "Anywhere Scanning", desc: "Scan links, QR codes, and messages from any app via share sheet." },
  { icon: RefreshCw, title: "Family Sync", desc: "Two-way protection network synced across all your devices." },
];

export default function MobileApp() {
  const { toast } = useToast();
  const [notified, setNotified] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNotify = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ mobile_launch_notify: true });
      setNotified(true);
      toast({ title: "We'll notify you", description: "You'll get an in-app alert when the mobile apps launch." });
    } catch {
      toast({ title: "Couldn't save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-3 text-center pt-4 animate-slide-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Smartphone className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Vardin Mobile</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Native iOS and Android apps are on the way — bringing real-time protection to your pocket.
        </p>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
          Coming Soon
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {FEATURES.map((f, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-border/50 bg-card space-y-2 animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <f.icon className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <PlatformCard name="iOS" badge="iPhone · iPad" />
        <PlatformCard name="Android" badge="Phone · Tablet" />
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center space-y-3">
        <h3 className="font-semibold">Want a heads up at launch?</h3>
        <p className="text-sm text-muted-foreground">
          We'll send an in-app alert the moment Vardin ships to the App Store and Google Play.
        </p>
        <Button
          onClick={handleNotify}
          disabled={notified || saving}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {notified ? "You're on the list" : "Notify me at launch"}
        </Button>
      </div>

      <div className="text-center pt-1">
        <Link to="/mobile-app/caller-id" className="text-xs text-muted-foreground/70 hover:text-primary inline-flex items-center gap-1">
          <PhoneCall className="w-3 h-3" /> Developer · iOS Caller-ID integration
        </Link>
      </div>
    </div>
  );
}

function PlatformCard({ name, badge }) {
  return (
    <div className="relative rounded-2xl border border-border/50 bg-card p-5 overflow-hidden">
      <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        UNDER CONSTRUCTION
      </div>
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Smartphone className="w-5 h-5 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg">{name}</h3>
      <p className="text-xs text-muted-foreground">{badge}</p>
      <div className="mt-3 h-2 w-2/3 rounded-full bg-muted animate-pulse" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-muted animate-pulse" />
    </div>
  );
}