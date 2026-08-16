import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check, Users, Clock, Sparkles, Loader2 } from "lucide-react";

export default function ReferralSection({ user }) {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${user.id}`;
  const bonusCredits = user.referral_bonus_credits || 0;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Referral.filter({ referrer_id: user.id }, "-created_date", 100);
        setReferrals(data);
      } catch {}
      setLoading(false);
    };
    load();
  }, [user.id]);

  const copyReferral = () => {
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const awardedCount = referrals.filter((r) => r.status === "awarded").length;
  const pendingCount = referrals.filter((r) => r.status === "pending").length;

  const statusBadge = (status) => {
    if (status === "awarded") return "bg-success/10 text-success";
    if (status === "pending") return "bg-warning/10 text-warning";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card className="rounded-2xl border-border/50 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">Refer & Earn</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Share your unique invite link. When someone you bring pays for a paid plan, you earn{" "}
        <span className="font-semibold text-primary">+30 bonus credits/month</span> — permanently.
      </p>

      {/* Invite link */}
      <div className="flex items-center gap-2">
        <Input readOnly value={referralLink} className="h-11 bg-muted/50 font-mono text-xs" />
        <Button size="sm" onClick={copyReferral} className="gap-1.5 flex-shrink-0">
          {copied ? (
            <><Check className="w-3.5 h-3.5" /> Copied</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> Copy</>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-center">
          <Sparkles className="w-4 h-4 text-primary mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">+{bonusCredits}</div>
          <div className="text-[11px] text-muted-foreground">bonus credits/mo</div>
        </div>
        <div className="rounded-xl bg-success/5 border border-success/15 p-3 text-center">
          <Users className="w-4 h-4 text-success mx-auto mb-1" />
          <div className="text-lg font-bold text-success">{awardedCount}</div>
          <div className="text-[11px] text-muted-foreground">joined & paid</div>
        </div>
        <div className="rounded-xl bg-warning/5 border border-warning/15 p-3 text-center">
          <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
          <div className="text-lg font-bold text-warning">{pendingCount}</div>
          <div className="text-[11px] text-muted-foreground">invited, pending</div>
        </div>
      </div>

      {/* Referral list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your referrals</p>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No referrals yet — share your invite link to start earning bonus credits.</p>
        ) : (
          referrals.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border/50 bg-card">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.referred_name || r.referred_email || "Invited user"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(r.created_date).toLocaleDateString()}
                  {r.status === "awarded" && r.plan ? ` · ${r.plan} plan` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {r.status === "awarded" && <span className="text-xs font-semibold text-success">+{r.bonus_credits}/mo</span>}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>
                  {r.status === "awarded" ? "Earned" : r.status === "pending" ? "Pending" : r.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}