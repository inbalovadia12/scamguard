import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Shield, Loader2, Crown, Zap, Star } from "lucide-react";
import { PREMIUM_FEATURES, ELITE_FEATURES, getCreditStatus, activatePlan, PLAN_PRICES } from "@/lib/credits";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For occasional checks",
    credits: "10 credits/month",
    features: [
      "10 AI scam analyses per month",
      "Text message analysis",
      "Risk score & explanation",
      "Basic next steps",
      "1 protected family member",
    ],
    notIncluded: ["Chrome extension", "Image upload", "AI Agent chat", "Advanced analytics"],
    icon: Shield,
    color: "from-slate-400 to-slate-500",
  },
  {
    id: "plus",
    name: "Plus",
    price: "$40",
    period: "/year",
    description: "For individuals who want more",
    credits: "100 credits/month",
    features: [
      "Everything in Free, plus:",
      "100 AI analyses per month",
      "Chrome Extension access",
      "Image upload & screenshots",
      "AI Agent chat",
      "5 protected family members",
      "Real-time guardian alerts",
    ],
    notIncluded: ["Bank account monitoring", "Advanced analytics", "Priority support"],
    icon: Zap,
    color: "from-blue-400 to-blue-500",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$80",
    period: "/year",
    description: "Complete family protection",
    credits: "100 credits/month",
    features: [
      "Everything in Plus, plus:",
      "100 AI analyses per month",
      "Bank account monitoring",
      "Priority scam pattern updates",
      "Auto-redaction of sensitive data",
      "Personalized risk profiles",
      "Detailed educational content",
    ],
    notIncluded: ["Unlimited family members", "Advanced analytics", "Custom rules"],
    icon: Sparkles,
    color: "from-primary to-primary/80",
    highlighted: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$120",
    period: "/year",
    description: "Maximum protection & insights",
    credits: "250 credits/month",
    features: ELITE_FEATURES,
    notIncluded: [],
    icon: Crown,
    color: "from-amber-400 to-orange-500",
  },
];

export default function Pricing() {
  const [credits, setCredits] = useState(null);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleSubscribe = async (planName) => {
    setSubscribing(planName);
    await activatePlan(planName);
    const updated = await getCreditStatus();
    setCredits(updated);
    setSubscribing(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Protect Your Family</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Choose the plan that keeps your loved ones safe from scams.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const isCurrent = credits?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 border transition-all duration-300 ${
                plan.highlighted
                  ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/10 lg:scale-[1.03]"
                  : "border-border/50 bg-card hover:border-border hover:shadow-md"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-3 shadow-sm`}>
                <plan.icon className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-bold text-lg">{plan.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-xs font-medium text-primary mt-1">{plan.credits}</p>
              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={subscribing !== null || isCurrent}
                variant={plan.highlighted ? "default" : "outline"}
                className={`w-full mt-5 ${plan.highlighted ? "bg-gradient-to-r from-primary to-primary/80" : ""}`}
              >
                {subscribing === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  "✓ Current Plan"
                ) : plan.id === "free" ? (
                  "Downgrade"
                ) : (
                  "Choose " + plan.name
                )}
              </Button>
              <div className="mt-5 space-y-2">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 opacity-40">
                    <X className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {credits && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>You've used {credits.creditsUsed} of {credits.limit} AI credits this month.</span>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>All plans include a 7-day money-back guarantee.</p>
        <p>Cancel anytime — your subscription remains active until the end of the billing period.</p>
      </div>
    </div>
  );
}