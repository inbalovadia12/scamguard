import React from "react";
import { Switch } from "@/components/ui/switch";
import { Users } from "lucide-react";
import { useCommunityData } from "@/hooks/useCommunityData";

export default function CommunityDataToggle({ className }) {
  const { enabled, setEnabled } = useCommunityData();

  return (
    <div className={`flex items-center justify-between gap-3 ${className || ""}`}>
      <div className="flex items-center gap-2.5">
        <Users className="w-4 h-4 text-primary flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">Community Data</p>
          <p className="text-xs text-muted-foreground">Enrich results with real stories from the Vardin community</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={setEnabled} />
    </div>
  );
}