import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Users, Plus, ShieldCheck, ShieldAlert, Mail, Settings, Trash2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddSeniorDialog from "@/components/family/AddSeniorDialog";

export default function Family() {
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadSeniors = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.ProtectedSenior.filter({ guardian_id: user.id });
    setSeniors(data);
    setLoading(false);
  };

  useEffect(() => { loadSeniors(); }, []);

  const handleDelete = async (id) => {
    await base44.entities.ProtectedSenior.delete(id);
    loadSeniors();
  };

  const handleUpdatePref = async (id, pref) => {
    await base44.entities.ProtectedSenior.update(id, { alert_preference: pref });
    loadSeniors();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">My Family</h1>
          <p className="text-muted-foreground mt-1">Manage the loved ones you're helping protect.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
          <Plus className="w-4 h-4" />
          Add Person
        </Button>
      </div>

      {seniors.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No one added yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add a family member or loved one to start protecting them from scams. You'll be notified whenever they check a suspicious message.
          </p>
          <Button onClick={() => setShowAdd(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add your first person
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {seniors.map((senior) => (
            <div key={senior.id} className="bg-card rounded-2xl border border-border/50 p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{senior.name}</h3>
                    {senior.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="w-3.5 h-3.5" />
                        {senior.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {senior.consent_given ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Consent given
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Pending consent
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                    <Select value={senior.alert_preference || "all"} onValueChange={(val) => handleUpdatePref(senior.id, val)}>
                      <SelectTrigger className="h-8 text-xs w-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All alerts</SelectItem>
                        <SelectItem value="high_risk_only">High risk only</SelectItem>
                        <SelectItem value="financial_only">Financial only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(senior.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSeniorDialog open={showAdd} onOpenChange={setShowAdd} onAdded={loadSeniors} />
    </div>
  );
}