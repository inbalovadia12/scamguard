import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Users, Plus, ShieldCheck, ShieldAlert, Mail, Settings, Trash2, Loader2,
  Clock, CheckCircle2, UserCog, BadgeCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddSeniorDialog from "@/components/family/AddSeniorDialog";
import { PLAN_FAMILY_LIMITS } from "@/lib/credits";
import { Link } from "react-router-dom";

function MemberAvatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm shadow-sm">
      {initials}
    </div>
  );
}

function MemberCard({ senior, index, onUpdatePref, onDelete }) {
  const isActive = senior.consent_given && senior.senior_user_id;
  const delayClass = index === 0 ? "" : index === 1 ? "anim-delay-1" : index === 2 ? "anim-delay-2" : "anim-delay-3";

  return (
    <div className={`bg-card rounded-2xl border border-border/50 p-5 animate-slide-up ${delayClass} hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-4">
        <MemberAvatar name={senior.name} />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate">{senior.name}</h3>
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <BadgeCheck className="w-3 h-3" />
                    Protected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                )}
              </div>
              {senior.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{senior.email}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Role: {isActive ? "Protected Senior" : "Invited Member"}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isActive ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-warning" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 border-t border-border/30">
            <div className="flex items-center gap-2 flex-1">
              <Settings className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <Select value={senior.alert_preference || "all"} onValueChange={(val) => onUpdatePref(senior.id, val)}>
                <SelectTrigger className="h-8 text-xs w-auto border-0 px-1 hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All alerts</SelectItem>
                  <SelectItem value="high_risk_only">High risk only</SelectItem>
                  <SelectItem value="financial_only">Financial only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onDelete(senior.id)} className="text-muted-foreground hover:text-destructive h-8 w-8 p-0">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Family() {
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [familyLimit, setFamilyLimit] = useState(1);
  const seniorsRef = useRef([]);

  const loadSeniors = async () => {
    const user = await base44.auth.me();
    let plan = user.subscription_plan || "starter";
    if (plan === "free") plan = "starter";
    if (plan === "elite") plan = "premium";
    setFamilyLimit(PLAN_FAMILY_LIMITS[plan] ?? PLAN_FAMILY_LIMITS.starter);
    const data = await base44.entities.ProtectedSenior.filter({ guardian_id: user.id });
    seniorsRef.current = data;
    setSeniors(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSeniors();

    const unsubscribe = base44.entities.ProtectedSenior.subscribe((event) => {
      if (!seniorsRef.current.some((s) => s.id === event.id)) return;
      if (event.type === "update") {
        setSeniors((prev) =>
          prev.map((s) => (s.id === event.id ? { ...s, ...event.data } : s))
        );
      } else if (event.type === "delete") {
        setSeniors((prev) => prev.filter((s) => s.id !== event.id));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
    await base44.entities.ProtectedSenior.delete(id);
  };

  const handleUpdatePref = async (id, pref) => {
    setSeniors((prev) =>
      prev.map((s) => (s.id === id ? { ...s, alert_preference: pref } : s))
    );
    await base44.entities.ProtectedSenior.update(id, { alert_preference: pref });
  };

  const activeMembers = seniors.filter((s) => s.consent_given && s.senior_user_id);
  const pendingMembers = seniors.filter((s) => !(s.consent_given && s.senior_user_id));

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
          <p className="text-muted-foreground mt-1">
            {seniors.length} / {familyLimit === Infinity ? "∞" : familyLimit} members
            {activeMembers.length > 0 && ` · ${activeMembers.length} active`}
            {pendingMembers.length > 0 && ` · ${pendingMembers.length} pending`}
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          disabled={familyLimit !== Infinity && seniors.length >= familyLimit}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80"
        >
          <Plus className="w-4 h-4" />
          Add Person
        </Button>
      </div>

      {familyLimit !== Infinity && seniors.length >= familyLimit && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-center space-y-2 animate-fade-in">
          <p className="text-sm text-muted-foreground">
            You've reached your plan's family member limit ({familyLimit}). Upgrade to protect more loved ones.
          </p>
          <Link to="/pricing">
            <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              Upgrade Plan
            </Button>
          </Link>
        </div>
      )}

      {seniors.length === 0 ? (
        <div className="text-center py-16 space-y-4 animate-scale-in">
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
        <div className="space-y-8">
          {activeMembers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <ShieldCheck className="w-4 h-4 text-success" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Members</h2>
                <span className="text-xs text-muted-foreground/60">({activeMembers.length})</span>
              </div>
              {activeMembers.map((senior, i) => (
                <MemberCard
                  key={senior.id}
                  senior={senior}
                  index={i}
                  onUpdatePref={handleUpdatePref}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {pendingMembers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Clock className="w-4 h-4 text-warning" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pending Invitations</h2>
                <span className="text-xs text-muted-foreground/60">({pendingMembers.length})</span>
              </div>
              {pendingMembers.map((senior, i) => (
                <MemberCard
                  key={senior.id}
                  senior={senior}
                  index={i}
                  onUpdatePref={handleUpdatePref}
                  onDelete={handleDelete}
                />
              ))}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                <UserCog className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p>Pending members need to accept their invitation and create a Vardin account to activate protection. You can resend invitations from their profile.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <AddSeniorDialog open={showAdd} onOpenChange={setShowAdd} onAdded={loadSeniors} />
    </div>
  );
}