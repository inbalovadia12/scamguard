import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Shield, Loader2 } from "lucide-react";
import { PREMIUM_FEATURES, getCreditStatus, activatePremium } from "@/lib/credits";

export default function Pricing() {
  const [credits, setCredits] = useState(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    await activatePremium();
    const updated = await getCreditStatus();
    setCredits(updated);
    setSubscribing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Protect Your Family</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Choose the plan that keeps your loved ones safe from scams.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="bg-white rounded-3xl border border-border/50 p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold">Free</h2>
            <p className="text-muted-foreground text-sm mt-1">For occasional checks</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <div className="space-y-3">
            <FeatureItem included>10 AI scam analyses per month</FeatureItem>
            <FeatureItem included>Text message analysis</FeatureItem>
            <FeatureItem included>Risk score & explanation</FeatureItem>
            <FeatureItem included>Basic next steps</FeatureItem>
            <FeatureItem notIncluded>Chrome extension</FeatureItem>
            <FeatureItem notIncluded>Image upload & screenshots</FeatureItem>
            <FeatureItem notIncluded>AI Agent chat</FeatureItem>
            <FeatureItem notIncluded>Guardian alerts</FeatureItem>
          </div>
          <Button variant="outline" className="w-full" disabled={credits?.plan === "free"}>
            {credits?.plan === "free" ? "Current Plan" : "Free"}
          </Button>
        </div>

        {/* Premium Plan */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-8 space-y-6 text-white relative shadow-xl shadow-blue-500/20">
          <div className="absolute -top-3 right-6 bg-amber-400 text-blue-900 text-xs font-bold px-3 py-1 rounded-full">
            BEST VALUE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-xl font-bold">Family Plan</h2>
            </div>
            <p className="text-blue-100 text-sm mt-1">Complete protection</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">$12</span>
            <span className="text-blue-100">/month</span>
          </div>
          <div className="space-y-3">
            {PREMIUM_FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-100 flex-shrink-0" />
                <span className="text-sm text-blue-50">{feature}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={handleSubscribe}
            disabled={subscribing || credits?.isPremium}
            className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold"
          >
            {subscribing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : credits?.isPremium ? (
              "✓ You're Premium"
            ) : (
              "Upgrade to Premium"
            )}
          </Button>
        </div>
      </div>

      {credits && (
        <div className="text-center text-sm text-muted-foreground">
          You've used {credits.creditsUsed} of {credits.limit} AI credits this month.
        </div>
      )}
    </div>
  );
}

function FeatureItem({ children, included, notIncluded }) {
  if (notIncluded) {
    return (
      <div className="flex items-center gap-2 opacity-50">
        <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground line-through">{children}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      <span className="text-sm">{children}</span>
    </div>
  );
}