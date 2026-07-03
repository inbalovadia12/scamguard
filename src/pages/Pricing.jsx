import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, Shield, Loader2, Zap, Sparkles, ShieldCheck } from "lucide-react";
import { getCreditStatus, startPaypalCheckout, PLAN_FEATURES } from "@/lib/credits";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    period: "/month",
    description: "For occasional checks",
    credits: "10 analyses/month",
    features: PLAN_FEATURES.starter,
    icon: Shield,
    color: "from-muted-foreground/40 to-muted-foreground/20",
  },
  {
    id: "plus",
    name: "Plus",
    price: "$40",
    period: "/year",
    description: "For proactive individuals",
    credits: "100 analyses/month",
    features: PLAN_FEATURES.plus,
    icon: Zap,
    color: "from-primary to-primary/80",
    highlighted: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "$80",
    period: "/year",
    description: "Complete family protection",
    credits: "250 analyses/month",
    features: PLAN_FEATURES.premium,
    icon: Sparkles,
    color: "from-chart-5 to-chart-5/80",
  },
];

export default function Pricing() {
  const [credits, setCredits] = useState(null);
  const [subscribing, setSubscribing] = useState(null);
  const [paypalStatus, setPaypalStatus] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalParam = params.get("paypal");
    if (paypalParam === "approved") {
      setPaypalStatus("approved");
    } else if (paypalParam === "cancelled") {
      setPaypalStatus("cancelled");
    }
    if (paypalParam) {
      window.history.replaceState({}, "", "/pricing");
    }
    getCreditStatus().then(setCredits);
  }, []);

  const handleSubscribe = async (planName) => {
    if (planName === "starter") return;
    setSubscribing(planName);
    try {
      await startPaypalCheckout(planName);
    } catch (error) {
      setSubscribing(null);
      setPaypalStatus("error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight font-heading">Choose Your Plan</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Protect yourself and your loved ones from scams.
        </p>
      </div>

      {paypalStatus === "approved" && (
        <div className="p-4 rounded-2xl bg-success/10 border border-success/20 text-center">
          <p className="text-sm font-medium text-success">
            ✓ Payment approved! Your subscription is being activated. This may take a few moments.
          </p>
        </div>
      )}
      {paypalStatus === "cancelled" && (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 text-center">
          <p className="text-sm font-medium text-warning">
            Payment cancelled. No charge was made.
          </p>
        </div>
      )}
      {paypalStatus === "error" && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
          <p className="text-sm font-medium text-destructive">
            Something went wrong with PayPal checkout. Please try again.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
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
                  RECOMMENDED
                </div>
              )}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-3 shadow-sm`}>
                <plan.icon className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-bold text-lg font-heading">{plan.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold font-heading">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-xs font-medium text-primary mt-1">{plan.credits}</p>
              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={subscribing !== null || isCurrent || plan.id === "starter"}
                variant={plan.highlighted ? "default" : "outline"}
                className={`w-full mt-5 ${plan.highlighted ? "bg-gradient-to-r from-primary to-primary/80" : ""}`}
              >
                {subscribing === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Redirecting...
                  </>
                ) : isCurrent ? (
                  "✓ Current Plan"
                ) : plan.id === "starter" ? (
                  "Free Plan"
                ) : (
                  "Choose " + plan.name
                )}
              </Button>
              <div className="mt-5 space-y-2">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-xs">{feature}</span>
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
        <p>All paid plans are billed annually via PayPal. Cancel anytime.</p>
        <p>Your subscription remains active until the end of the billing period.</p>
      </div>
    </div>
  );
}