import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Sparkles, TrendingUp } from "lucide-react";
import { CREDIT_PACKS, startCreditPurchase } from "@/lib/credits";

const PACK_META = {
  small: { icon: Zap, gradient: "from-blue-500 to-cyan-500", glow: "shadow-blue-500/20" },
  medium: { icon: Sparkles, gradient: "from-violet-500 to-fuchsia-500", glow: "shadow-violet-500/20" },
  large: { icon: TrendingUp, gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/20" },
};

export default function CreditPacks() {
  const [purchasing, setPurchasing] = useState(null);

  const handlePurchase = async (packKey) => {
    setPurchasing(packKey);
    try {
      await startCreditPurchase(packKey);
    } catch {
      setPurchasing(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold font-heading">Top Up Credits</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Need more credits this month? Buy a one-time credit pack — no subscription required.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(CREDIT_PACKS).map(([key, pack]) => {
          const meta = PACK_META[key];
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className={`relative rounded-2xl p-5 border transition-all animate-slide-up ${
                pack.popular
                  ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/10"
                  : "border-border/50 bg-card hover:border-border hover:shadow-md"
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  BEST VALUE
                </div>
              )}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center mb-3 shadow-md ${meta.glow}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-sm">{pack.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-heading">{pack.displayPrice}</span>
                <span className="text-xs text-muted-foreground">one-time</span>
              </div>
              <p className="text-xs text-primary mt-1 font-medium">{pack.credits} AI credits</p>
              <Button
                onClick={() => handlePurchase(key)}
                disabled={purchasing !== null}
                variant={pack.popular ? "default" : "outline"}
                className={`w-full mt-4 ${pack.popular ? "bg-gradient-to-r from-primary to-primary/80" : ""}`}
                size="sm"
              >
                {purchasing === key ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  "Buy Now"
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}