import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { Link2, MessageSquare, Image, QrCode, Mail, Phone, MessageCircle, Bell, Shield } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const DEFAULTS = {
  link_protection: true, message_protection: true, image_scanning: true,
  qr_scanning: true, email_protection: true, call_protection: true,
  ask_family: true, guardian_notifications: true, protection_level: "standard",
};

const LEVELS = [
  { value: "basic", label: "Basic", desc: "Core scam detection" },
  { value: "standard", label: "Standard", desc: "Balanced protection" },
  { value: "maximum", label: "Maximum", desc: "All features on" },
];

const TOGGLES = [
  { key: "link_protection", label: "Link Protection", icon: Link2 },
  { key: "message_protection", label: "Message Protection", icon: MessageSquare },
  { key: "image_scanning", label: "Image Scanning", icon: Image },
  { key: "qr_scanning", label: "QR Scanning", icon: QrCode },
  { key: "email_protection", label: "Email Protection", icon: Mail },
  { key: "call_protection", label: "Call Protection", icon: Phone },
  { key: "ask_family", label: "Ask Family", icon: MessageCircle },
  { key: "guardian_notifications", label: "Guardian Notifications", icon: Bell },
];

export default function ProtectionSettingsPanel({ senior, onUpdate }) {
  const [settings, setSettings] = useState({ ...DEFAULTS, ...(senior.protection_settings || {}) });
  const [saving, setSaving] = useState(false);

  const save = async (newSettings) => {
    setSettings(newSettings);
    setSaving(true);
    try {
      await base44.entities.ProtectedSenior.update(senior.id, { protection_settings: newSettings });
      onUpdate?.(senior.id, newSettings);
    } catch (e) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-3 border-t border-border/40">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protection Level</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              onClick={() => save({ ...settings, protection_level: lvl.value })}
              className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border text-left transition-all ${settings.protection_level === lvl.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"}`}
            >
              <span className="text-xs font-semibold">{lvl.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{lvl.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TOGGLES.map(({ key, label, icon: Icon }) => (
          <label key={key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/40 cursor-pointer hover:bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium truncate">{label}</span>
            </div>
            <Switch checked={!!settings[key]} onCheckedChange={(v) => save({ ...settings, [key]: v })} />
          </label>
        ))}
      </div>

      {saving && <p className="text-[10px] text-muted-foreground text-right">Saving...</p>}
    </div>
  );
}