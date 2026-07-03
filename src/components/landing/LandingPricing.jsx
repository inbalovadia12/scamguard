import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Shield, Zap, Sparkles, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    description: "For occasional checks",
    credits: "10 analyses/month",
    icon: Shield,
    color: "from-muted-foreground/40 to-muted-foreground/20",
    features: ["10 AI analyses per month", "Basic risk scores", "Community reports", "1 protected family member"],
    highlighted: false,
  },
  {
    name: "Plus",
    price: "$40",
    period: "/year",
    description: "For proactive individuals",
    credits: "100 analyses/month",
    icon: Zap,
    color: "from-primary to-primary/80",
    features: ["100 AI analyses/month", "AI explanations", "Email & SMS analysis", "Marketplace protection", "Screenshot analysis", "Priority support"],
    highlighted: true,
  },
  {
    name: "Premium",
    price: "$80",
    period: "/year",
    description: "Complete family protection",
    credits: "250 analyses/month",
    icon: Sparkles,
    color: "from-chart-5 to-chart-5/80",
    features: ["250 AI analyses/month", "Family protection system", "Shared scam alerts", "Unlimited family members", "Advanced AI models", "Premium analytics"],
    highlighted: false,
  },
];

export default function LandingPricing() {
  return (
    <section id="pricing" className="py-24 border-y border-border/50 bg-card/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">Simple, Transparent Pricing</h2>
          <p className="mt-4 text-lg text-muted-foreground">Choose the plan that fits your needs. Upgrade or cancel anytime.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-6 border transition-all duration-300 ${
                plan.highlighted
                  ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/10 lg:scale-[1.03]"
                  : "border-border/50 bg-background hover:border-border hover:shadow-md"
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
              <h3 className="font-bold text-lg font-heading">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold font-heading">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-sm font-medium text-primary mt-1">{plan.credits}</p>
              <Link to="/register" className="block mt-5">
                <Button className={`w-full ${plan.highlighted ? "bg-gradient-to-r from-primary to-primary/80" : ""}`} variant={plan.highlighted ? "default" : "outline"}>
                  Get Started <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <div className="mt-5 space-y-2.5">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}