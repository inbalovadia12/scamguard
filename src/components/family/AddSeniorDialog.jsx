import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Mail } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function AddSeniorDialog({ open, onOpenChange, onAdded }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [alertPref, setAlertPref] = useState("all");
  const [saving, setSaving] = useState(false);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const handleSave = async () => {
    if (!name.trim() || !emailValid) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke("addFamilyMember", {
        name: name.trim(),
        email: email.trim(),
        alert_preference: alertPref,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Added!",
        description: `${name.trim()} has been added and an invite with a join link was sent to ${email.trim()}.`,
      });
      setName("");
      setEmail("");
      setAlertPref("all");
      onOpenChange(false);
      if (onAdded) await onAdded();
    } catch (err) {
      const msg = err?.message || "Could not add family member.";
      const isLimit = /limit/i.test(msg);
      toast({
        title: isLimit ? "Family member limit reached" : "Something went wrong",
        description: isLimit ? `${msg} Upgrade your plan or ask an admin to raise your member limit.` : msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
            Add a family member you'd like to help protect from scams. We'll email them a link to join Vardin and share your plan benefits.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Mom, Dad, Grandma Rose" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Email <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Their email address"
                className="h-11 pl-9"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Required. We'll send them an invite with a link to join your family and share your plan benefits.</p>
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
          <Button onClick={handleSave} disabled={!name.trim() || !emailValid || saving} className="w-full h-11 bg-gradient-to-r from-primary to-primary/80">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Add to My Family
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}