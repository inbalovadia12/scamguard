import React, { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCAM_TYPE_OPTIONS, CHANNEL_OPTIONS, RISK_OPTIONS } from "@/components/scam/ScamReportCard";

export default function ReportScamDialog({ open, onOpenChange, onSubmitted }) {
  const [form, setForm] = useState({
    scam_type: "phishing_email",
    title: "",
    summary: "",
    risk_level: "high",
    channel: "email",
    country: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      setError("Please provide a title and summary.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { base44 } = await import("@/api/base44Client");
      await base44.entities.ScamReport.create({
        ...form,
        title: form.title.trim().slice(0, 200),
        summary: form.summary.trim().slice(0, 1000),
        country: form.country.trim().slice(0, 60) || undefined,
      });
      setForm({ scam_type: "phishing_email", title: "", summary: "", risk_level: "high", channel: "email", country: "" });
      onOpenChange(false);
      onSubmitted?.();
    } catch (e) {
      setError(e.message || "Failed to submit report.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border/50 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold font-heading">Report a Scam</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Help others by sharing scams you've encountered. Do not include personal information.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Scam Type</Label>
            <Select value={form.scam_type} onValueChange={(v) => update("scam_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCAM_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Headline</Label>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Fake USPS package delivery text"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>What happened?</Label>
            <Textarea
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              placeholder="Describe the scam. Redact any personal info, phone numbers, or real names."
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Risk Level</Label>
              <Select value={form.risk_level} onValueChange={(v) => update("risk_level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => update("channel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Country <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder="e.g. US, UK, AU"
              maxLength={60}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Report"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}