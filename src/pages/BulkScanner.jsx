import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import BulkPhoneScanner from "@/components/scam/BulkPhoneScanner";
import { getCreditStatus } from "@/lib/credits";

export default function BulkScanner() {
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  if (!credits) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return <BulkPhoneScanner credits={credits} onCreditsChange={setCredits} />;
}