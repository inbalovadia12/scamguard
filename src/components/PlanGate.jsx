import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function PlanGate({ icon: Icon, title, description, plan = "Plus" }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl border border-border/50 p-8 sm:p-10 text-center space-y-4 animate-slide-up flex flex-col items-center">
        {Icon && (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-8 h-8 text-primary" />
          </div>
        )}
        <h1 className="text-xl font-bold font-heading">{title}</h1>
        {description && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Crown className="w-4 h-4" /> {plan} Feature
        </div>
        <Button asChild className="w-full max-w-xs">
          <Link to="/pricing">Upgrade to {plan}</Link>
        </Button>
      </div>
    </div>
  );
}