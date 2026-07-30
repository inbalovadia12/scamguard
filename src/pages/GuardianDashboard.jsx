import React from "react";
import { ShieldCheck } from "lucide-react";
import GuardianDashboardPanel from "@/components/family/GuardianDashboardPanel";

export default function GuardianDashboard() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Guardian Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          At-a-glance status for all the family members you protect.
        </p>
      </div>
      <GuardianDashboardPanel />
    </div>
  );
}