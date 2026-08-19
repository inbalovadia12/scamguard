import React, { useState, useEffect } from "react";
import { PhoneCall, ShieldCheck, Loader2, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function CallGuardSection() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("none");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await base44.auth.me();
        setEnabled(me.call_guard_enabled || false);
        setStatus(me.call_guard_status || "none");
        setPhoneNumber(me.call_guard_phone_number || "");
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  const handleToggle = async (checked) => {
    if (checked) {
      if (!phoneNumber.trim()) {
        setShowPhoneInput(true);
        setEnabled(false);
        return;
      }
      await handleEnable();
    } else {
      await handleDisable();
    }
  };

  const handleEnable = async () => {
    setToggling(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("toggleCallGuard", {
        action: "enable",
        phone_number: phoneNumber.trim(),
      });
      if (response.data?.error) throw new Error(response.data.error);
      const approvalUrl = response.data?.approval_url;
      if (approvalUrl) {
        window.location.href = approvalUrl;
      }
    } catch (e) {
      setError(e.message);
      setToggling(false);
    }
  };

  const handleDisable = async () => {
    setToggling(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("toggleCallGuard", { action: "disable" });
      if (response.data?.error) throw new Error(response.data.error);
      setStatus("cancelled");
      setEnabled(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setToggling(false);
    }
  };

  const isActive = status === "active";

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm flex-shrink-0">
            <PhoneCall className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg font-heading">Call Guard</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Add-on
              </span>
              {isActive && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              )}
              {status === "cancelled" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                  Cancelled
                </span>
              )}
              {status === "expired" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  Expired
                </span>
              )}
            </div>
            <p className="text-2xl font-bold font-heading mt-1">$3<span className="text-sm font-normal text-muted-foreground">/month</span></p>
          </div>
        </div>
        {!loading && (
          <div className="flex flex-col items-end gap-1">
            <Switch
              checked={enabled && isActive}
              onCheckedChange={handleToggle}
              disabled={toggling || loading}
            />
            <span className="text-[10px] text-muted-foreground">{toggling ? "Processing..." : isActive ? "Enabled" : "Disabled"}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Call Guard uses an AI voice agent to screen incoming calls on your behalf. The agent answers, asks callers a few quick questions, summarizes the conversation, and sends the call information to Vardin for post-call scam analysis — so you get a risk verdict before deciding whether to call back.
        </p>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enabling Call Guard gives Vardin access to calls processed through Call Guard, including the call summary, transcript, and caller details. This data is used solely for scam detection and your safety.
        </p>
      </div>

      {/* Phone number input (shown when enabling without a number on file) */}
      {showPhoneInput && !isActive && (
        <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Your phone number</label>
            <p className="text-xs text-muted-foreground mb-2">Enter the phone number that Call Guard should screen. Include the country code (e.g., +1 for US).</p>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              className="h-11"
            />
          </div>
          <Button onClick={handleEnable} disabled={toggling || !phoneNumber.trim()} className="w-full">
            {toggling ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Redirecting to PayPal...</> : "Continue to PayPal — $3/month"}
          </Button>
        </div>
      )}

      {/* Status row */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Call Guard status...
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current status:</span>
          <span className={`font-medium ${isActive ? "text-success" : status === "cancelled" ? "text-warning" : status === "expired" ? "text-destructive" : "text-muted-foreground"}`}>
            {isActive ? "Active — Call Guard is screening your calls" : status === "cancelled" ? "Cancelled — Call Guard is inactive" : status === "expired" ? "Expired — Call Guard is inactive" : "Not enabled"}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Pricing note */}
      <p className="text-xs text-center text-muted-foreground">
        Call Guard is a monthly add-on billed separately via PayPal. Cancel anytime.
      </p>
    </div>
  );
}