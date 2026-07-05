import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function LockedFeature({ title, description, buttonLabel = "Upgrade Now", icon: Icon = Lock }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-warning/10 flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-warning" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading mb-4">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">{description}</p>
        <Link to="/pricing" className="inline-block">
          <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
            {buttonLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}