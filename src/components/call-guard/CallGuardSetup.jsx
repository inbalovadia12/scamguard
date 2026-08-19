import React, { useState } from "react";
import { PhoneCall, ShieldCheck, CheckCircle2, Loader2, Edit2, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CallGuardSetup({ user, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.call_guard_phone_number || "");
  const [saving, setSaving] = useState(false);

  const currentNumber = user?.call_guard_phone_number || "";
  const isReady = currentNumber.length > 0;

  const handleSave = async () => {
    const normalized = phoneNumber.trim().replace(/[^\d]/g, "");
    if (!normalized) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({ call_guard_phone_number: normalized });
      setEditing(false);
      if (onUpdate) await onUpdate();
    } catch {}
    setSaving(false);
  };

  const handleCancel = () => {
    setPhoneNumber(currentNumber);
    setEditing(false);
  };

  const formatPhone = (digits) => {
    if (!digits) return "";
    const d = digits.replace(/[^\d]/g, "");
    if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return digits.startsWith("+") ? digits : `+${digits}`;
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="font-semibold font-heading">Setup & Status</h2>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
          isReady
            ? "bg-success/10 text-success border border-success/20"
            : "bg-warning/10 text-warning border border-warning/20"
        }`}>
          {isReady ? <><CheckCircle2 className="w-3 h-3" /> Ready</> : "Needs Setup"}
        </span>
      </div>

      {/* Phone number section */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Your phone number</label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter the phone number that Call Guard should screen. Include the country code (e.g., +1 for US).
        </p>

        {editing ? (
          <div className="space-y-3">
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              className="h-11"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !phoneNumber.trim()} size="sm">
                {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save</>}
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm" disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">
                {currentNumber ? formatPhone(currentNumber) : "No number set"}
              </span>
            </div>
            <Button onClick={() => { setPhoneNumber(currentNumber); setEditing(true); }} variant="ghost" size="sm">
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              {currentNumber ? "Change" : "Set number"}
            </Button>
          </div>
        )}
      </div>

      {/* Setup instructions */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <h3 className="text-sm font-medium">How to connect your phone</h3>
        <ol className="space-y-2.5">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter the phone number you want Call Guard to screen above. This is the number callers dial.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Set up call forwarding on your phone to route incoming calls through the Call Guard service. Contact your carrier if you need help with call forwarding.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When someone calls, the AI voice agent answers and asks them a few quick questions to identify the caller and their intent.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">4</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              After the call, Vardin analyzes the conversation and posts a SAFE, SUSPICIOUS, or SCAM verdict in the Recent Calls section below.
            </p>
          </li>
        </ol>
      </div>

      {/* Ready state */}
      {isReady && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success/5 border border-success/20">
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          <p className="text-xs text-success font-medium">Call Guard is ready — incoming calls to your number will be screened.</p>
        </div>
      )}
    </div>
  );
}