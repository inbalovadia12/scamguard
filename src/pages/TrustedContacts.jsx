import React, { useState, useEffect } from "react";
import { ShieldCheck, Plus, Trash2, Phone, Mail, Globe, Link as LinkIcon, Loader2, ShieldOff, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_META = {
  phone: { label: "Phone Number", icon: Phone, placeholder: "+1 555 123 4567" },
  email: { label: "Email Address", icon: Mail, placeholder: "name@example.com" },
  domain: { label: "Domain", icon: Globe, placeholder: "example.com" },
  url: { label: "Website URL", icon: LinkIcon, placeholder: "https://example.com" },
};

const TYPE_OPTIONS = Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }));

export default function TrustedContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ contact_type: "email", contact_value: "", label: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.TrustedContact.list("-created_date", 100);
      setContacts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.contact_value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await base44.entities.TrustedContact.create({
        ...form,
        contact_value: form.contact_value.trim().slice(0, 500),
        label: form.label.trim().slice(0, 100) || undefined,
        notes: form.notes.trim().slice(0, 500) || undefined,
      });
      setForm({ contact_type: "email", contact_value: "", label: "", notes: "" });
      setDialogOpen(false);
      loadContacts();
    } catch (e) {
      setError(e.message || "Failed to add contact.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.TrustedContact.delete(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-slide-up">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-heading">Trusted Contacts</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Pre-verify phone numbers, emails, and domains as safe. Future scans from these sources will show a "trusted" badge.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Contact</span>
        </Button>
      </div>

      {/* Contact grid */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Loading trusted contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
            <ShieldOff className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No trusted contacts yet. Add phone numbers, emails, or domains you know are safe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
          {contacts.map((contact) => {
            const meta = TYPE_META[contact.contact_type] || TYPE_META.email;
            const Icon = meta.icon;
            return (
              <div key={contact.id} className="bg-card rounded-2xl border border-border/50 p-4 space-y-2 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-success" />
                    </div>
                    <div className="min-w-0">
                      {contact.label && <p className="font-semibold text-sm truncate">{contact.label}</p>}
                      <p className="text-sm text-muted-foreground truncate">{contact.contact_value}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(contact.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {contact.notes && <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">{contact.notes}</p>}
                <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  Trusted {meta.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setDialogOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-card border border-border/50 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold font-heading">Add Trusted Contact</h2>
                <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Contact Type</Label>
                <Select value={form.contact_type} onValueChange={(v) => update("contact_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={form.contact_value}
                  onChange={(e) => update("contact_value", e.target.value)}
                  placeholder={TYPE_META[form.contact_type]?.placeholder || ""}
                />
              </div>

              <div className="space-y-2">
                <Label>Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.label}
                  onChange={(e) => update("label", e.target.value)}
                  placeholder="e.g. Mom's phone, Work email"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Why do you trust this contact?"
                  rows={2}
                  maxLength={500}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAdd} disabled={saving || !form.contact_value.trim()}>
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : "Add Contact"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}