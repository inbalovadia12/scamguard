import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

export default function AddSeniorDialog({ open, onOpenChange, onAdded }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [alertPref, setAlertPref] = useState("all");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.ProtectedSenior.create({
      name: name.trim(),
      email: email.trim() || undefined,
      guardian_id: user.id,
      consent_given: false,
      alert_preference: alertPref,
    });
    setSaving(false);
    setName("");
    setEmail("");
    setAlertPref("all");
    onAdded();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add a Loved One
          </DialogTitle>
          <DialogDescription>
            Add a family member you'd like to help protect from scams. They'll need to give their consent before monitoring begins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Mom, Dad, Grandma Rose" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email address" className="h-11" />
            <p className="text-xs text-muted-foreground">We'll send them an invite to connect their account.</p>
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
          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full h-11 bg-gradient-to-r from-primary to-primary/80">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Add to My Family
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}