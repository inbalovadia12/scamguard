import React, { useState } from "react";
import { Settings, Bell, Trash2, ShieldCheck, Loader2, Power, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function CallGuardSettings({ user, onUpdate }) {
  const [toggling, setToggling] = useState(false);
  const [guardEnabled, setGuardEnabled] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);

  const notificationsEnabled = user?.call_guard_notifications !== false;

  const handleToggleGuard = async (checked) => {
    if (!checked) {
      setGuardEnabled(false);
      setToggling(true);
      setError(null);
      try {
        await base44.functions.invoke("toggleCallGuard", { action: "disable" });
        if (onUpdate) await onUpdate();
      } catch (e) {
        setGuardEnabled(true);
        setError(e.message || "Failed to disable Call Guard.");
      }
      setToggling(false);
    }
  };

  const handleToggleNotifications = async (checked) => {
    setNotifSaving(true);
    setError(null);
    try {
      await base44.auth.updateMe({ call_guard_notifications: checked });
      if (onUpdate) await onUpdate();
    } catch (e) {
      setError("Failed to update notification setting.");
    }
    setNotifSaving(false);
  };

  const handleDeleteHistory = async () => {
    setDeleting(true);
    setError(null);
    try {
      await base44.entities.CallGuardReport.deleteMany({ user_id: user.id });
      setShowDeleteConfirm(false);
      if (onUpdate) await onUpdate();
    } catch (e) {
      setError("Failed to delete call history.");
    }
    setDeleting(false);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="font-semibold font-heading">Settings</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-xl bg-destructive/5 border border-destructive/20">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Notifications */}
      <div className="flex items-center justify-between gap-4 py-3 border-b border-border/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get notified when Call Guard screens a call and posts a verdict.</p>
          </div>
        </div>
        <Switch
          checked={notificationsEnabled}
          onCheckedChange={handleToggleNotifications}
          disabled={notifSaving}
        />
      </div>

      {/* Call history / Delete */}
      <div className="flex items-center justify-between gap-4 py-3 border-b border-border/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">Delete call history</p>
            <p className="text-xs text-muted-foreground mt-0.5">Permanently remove all call reports and transcripts.</p>
          </div>
        </div>
        <Button
          onClick={() => setShowDeleteConfirm(true)}
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/30 hover:bg-destructive/5"
        >
          Delete
        </Button>
      </div>

      {/* Privacy info */}
      <div className="flex items-start gap-3 py-3 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Privacy</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Call Guard processes call summaries, transcripts, and caller details solely for scam detection and your safety. Your data is private to your account and is never shared with third parties. You can delete your entire call history at any time.
          </p>
        </div>
      </div>

      {/* Enable / Disable toggle */}
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Power className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Call Guard active</p>
            <p className="text-xs text-muted-foreground mt-0.5">Toggle off to cancel your $3/month subscription and stop screening.</p>
          </div>
        </div>
        <Switch
          checked={guardEnabled}
          onCheckedChange={handleToggleGuard}
          disabled={toggling}
        />
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete all call history?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed py-2">
            This will permanently delete all Call Guard reports and transcripts for your account. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button onClick={() => setShowDeleteConfirm(false)} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleDeleteHistory} disabled={deleting} variant="destructive" size="sm">
              {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}