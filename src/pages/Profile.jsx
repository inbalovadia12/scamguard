import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck, Crown, Mail, Loader2, Bell, Lock, LogOut, ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getCreditStatus, PLAN_NAMES, PLAN_LIMITS } from "@/lib/credits";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [credits, setCredits] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [alertPref, setAlertPref] = useState("all");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [privacyRedact, setPrivacyRedact] = useState(true);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setAlertPref(user.alert_preference || "all");
      setNotifyEmail(user.notify_email !== false);
      setPrivacyRedact(user.privacy_auto_redact !== false);
    }
  }, [user]);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: fullName.trim(),
        alert_preference: alertPref,
        notify_email: notifyEmail,
        privacy_auto_redact: privacyRedact,
      });
      await checkUserAuth();
      toast({ title: "Saved", description: "Your profile has been updated." });
    } catch (err) {
      toast({ title: "Something went wrong", description: err.message || "Could not save changes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = (user.full_name || user.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const plan = credits?.plan || user.subscription_plan || "starter";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-xl font-bold text-primary-foreground shadow-md shadow-primary/20">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">{user.full_name || "Your Profile"}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Mail className="w-3.5 h-3.5" />
            {user.email}
          </p>
        </div>
      </div>

      {/* Plan & Credits Card */}
      <Card className="rounded-2xl border-border/50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan === "premium" ? "bg-chart-5/10" : "bg-primary/10"}`}>
              <Crown className={`w-5 h-5 ${plan === "premium" ? "text-chart-5" : "text-primary"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Plan</p>
              <p className="font-semibold text-lg">{PLAN_NAMES[plan] || "Starter"}</p>
            </div>
          </div>
          {plan !== "premium" && (
            <Link to="/pricing">
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-primary/80">
                Upgrade <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>

        {credits && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">AI Credits this month</span>
              <span className="text-sm font-medium">{credits.creditsUsed} / {credits.limit}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all"
                style={{ width: `${Math.min(100, (credits.creditsUsed / credits.limit) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Account Info */}
      <Card className="rounded-2xl border-border/50 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user.email || ""} disabled className="h-11 bg-muted/50" />
          <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="rounded-2xl border-border/50 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Email alerts</p>
            <p className="text-xs text-muted-foreground">Receive email when family members check a message</p>
          </div>
          <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
        </div>
        <div className="space-y-2">
          <Label>Alert me for</Label>
          <Select value={alertPref} onValueChange={setAlertPref}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All messages checked</SelectItem>
              <SelectItem value="high_risk_only">High risk only</SelectItem>
              <SelectItem value="financial_only">Financial-related only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Privacy */}
      <Card className="rounded-2xl border-border/50 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Privacy</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto-redact personal info</p>
            <p className="text-xs text-muted-foreground">Remove names, numbers & addresses before storing messages</p>
          </div>
          <Switch checked={privacyRedact} onCheckedChange={setPrivacyRedact} />
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-destructive gap-2">
          <LogOut className="w-4 h-4" />
          Log out
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}