import React from "react";
import { Gift } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import ReferralSection from "@/components/referral/ReferralSection";
import { Loader2 } from "lucide-react";

export default function Referral() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth && !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Gift className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Sign in to view your referral code and earned bonuses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl luxury-gradient-btn flex items-center justify-center shadow-md shadow-primary/20 flex-shrink-0">
          <Gift className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Refer & Earn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share your unique referral link. When someone you invite activates a paid plan, you earn a permanent monthly credit bonus.
          </p>
        </div>
      </div>
      <ReferralSection user={user} />
    </div>
  );
}