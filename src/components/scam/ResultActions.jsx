import React, { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import AskFamilyButton from "@/components/family/AskFamilyButton";
import ReportScamDialog from "@/components/scam/ReportScamDialog";
import { useKidMode } from "@/lib/KidModeContext";

const MESSAGE_TYPE_TO_SCAM = {
  sms: "smishing",
  email: "phishing_email",
  job_offer: "fake_job",
  marketplace: "marketplace",
  romance: "romance",
  bank_government: "bank_impersonation",
  tech_support: "tech_support",
  crypto_investment: "crypto_investment",
  delivery: "delivery",
  lottery_prize: "lottery_prize",
  charity: "other",
  url: "phishing_email",
  other: "other",
};

const RISK_TO_REPORT_RISK = { low: "low", medium: "medium", high: "high" };

// analysisType: "scam_analysis" | "conversation" | "image" | "live_guard"
export default function ResultActions({ analysis, analysisType = "scam_analysis", messageType }) {
  const { kidMode } = useKidMode();
  const [reportOpen, setReportOpen] = useState(false);
  const level = analysis.risk_level || "low";
  if (level !== "medium" && level !== "high") return null;

  const scamType = MESSAGE_TYPE_TO_SCAM[messageType] || analysis.message_type || "other";
  const excerpt = (analysis.message_text || analysis.transcript || analysis.explanation || "").slice(0, 300);

  const prefill = {
    scam_type: scamType,
    title: (analysis.message_text || analysis.transcript || "").slice(0, 120) || "Flagged scan",
    summary: excerpt,
    risk_level: RISK_TO_REPORT_RISK[level] || "high",
  };

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <AskFamilyButton
        analysisId={analysis.id}
        analysisType={analysisType}
        threatExcerpt={excerpt}
        riskLevel={level}
        scamType={scamType}
      />
      <Button variant="outline" size="sm" onClick={() => setReportOpen(true)} className="gap-2">
        <Flag className="w-4 h-4" />
        {kidMode ? "Tell on this scam" : "Report Scam"}
      </Button>
      <ReportScamDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        prefill={prefill}
        onSubmitted={() => toast({ title: "Your report helps protect the community" })}
      />
    </div>
  );
}