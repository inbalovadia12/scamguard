import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Loader2, Send, Phone, MessageSquare, Flag, Share2 } from "lucide-react";
import AnalysisResult from "@/components/scam/AnalysisResult";

export default function AlertDetail() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingWarning, setSendingWarning] = useState(false);
  const [warningSent, setWarningSent] = useState(false);
  const [warningError, setWarningError] = useState(null);
  const [seniorEmail, setSeniorEmail] = useState(null);
  const [seniorName, setSeniorName] = useState("");
  const [seniorPhone, setSeniorPhone] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await base44.entities.ScamAnalysis.get(id);
      setAnalysis(data);
      setNotes(data.guardian_notes || "");
      if (data.guardian_status === "new") {
        await base44.entities.ScamAnalysis.update(id, { guardian_status: "reviewed" });
        data.guardian_status = "reviewed";
      }
      if (data.senior_id) {
        try {
          const senior = await base44.entities.ProtectedSenior.get(data.senior_id);
          setSeniorEmail(senior.email);
          setSeniorName(senior.name || "");
          setSeniorPhone(senior.phone || "");
        } catch {
          const seniors = await base44.entities.ProtectedSenior.filter({ senior_user_id: data.senior_id });
          if (seniors.length > 0) {
            setSeniorEmail(seniors[0].email);
            setSeniorName(seniors[0].name || "");
            setSeniorPhone(seniors[0].phone || "");
          }
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleMarkHandled = async () => {
    setSaving(true);
    await base44.entities.ScamAnalysis.update(id, {
      guardian_status: "handled",
      guardian_notes: notes,
    });
    setAnalysis((prev) => ({ ...prev, guardian_status: "handled", guardian_notes: notes }));
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await base44.entities.ScamAnalysis.update(id, { guardian_notes: notes });
    setSaving(false);
  };

  const handleSendWarning = async () => {
    if (!seniorEmail) return;
    setSendingWarning(true);
    setWarningError(null);
    const riskLabel = (analysis.risk_level || "potential").toUpperCase();
    const scamType = (analysis.message_type || "scam").replace(/_/g, " ");
    const steps = analysis.next_steps?.length
      ? analysis.next_steps.map((s) => `• ${s}`).join("\n")
      : "• Do not share personal info, passwords, or send money\n• Do not respond to the sender\n• Block and report the sender";
    const body = `Hi ${seniorName || "there"},\n\nI wanted to warn you about a ${riskLabel} RISK ${scamType} scam that was detected.\n\n${analysis.explanation || "This message shows signs of being a scam."}\n\nWhat you should do:\n${steps}\n\nPlease be careful. If you receive a similar message, don't respond and let me know right away.\n\nStay safe!`;
    try {
      await base44.integrations.Core.SendEmail({
        to: seniorEmail,
        subject: `⚠️ Scam Warning: ${riskLabel} risk ${scamType} detected`,
        body,
      });
      setWarningSent(true);
    } catch {
      setWarningError("Could not send — the family member must be a registered app user.");
    } finally {
      setSendingWarning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Alert not found.</p>
        <Link to="/alerts" className="text-primary hover:underline mt-2 inline-block">Back to alerts</Link>
      </div>
    );
  }

  const reassuranceBody = encodeURIComponent(`Hi ${seniorName || "there"}, I got a scam alert about a ${analysis.message_type?.replace(/_/g, " ") || "suspicious message"} targeting you. Please don't click any links or share personal info. Delete the message and call me if you're unsure. Stay safe!`);
  const telLink = seniorPhone ? `tel:${seniorPhone}` : null;
  const smsLink = seniorPhone ? `sms:${seniorPhone}?body=${reassuranceBody}` : null;

  const alertUrl = `${window.location.origin}/alerts/${id}`;
  const shareSummary = `⚠️ Scam Alert — ${(analysis.risk_level || "unknown").toUpperCase()} RISK\nType: ${(analysis.message_type || "suspicious message").replace(/_/g, " ")}\n\n${analysis.explanation || "This message shows signs of being a scam."}${analysis.tactics_detected?.length ? `\n\nTactics detected:\n${analysis.tactics_detected.map((t) => `• ${t}`).join("\n")}` : ""}${analysis.next_steps?.length ? `\n\nWhat to do:\n${analysis.next_steps.map((s) => `• ${s}`).join("\n")}` : ""}\n\nView full alert: ${alertUrl}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Scam Alert from Vardin Scamguard",
          text: shareSummary,
          url: alertUrl,
        });
      } catch {
        // User cancelled share — no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareSummary);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard not available
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/alerts">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Alert Detail</h1>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Original message</h3>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.message_text}</p>
      </div>

      <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6">
        <AnalysisResult analysis={analysis} />
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
        <h3 className="font-semibold font-heading">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a
            href={telLink || "#"}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${telLink ? "border-border/50 hover:bg-muted/30" : "border-border/30 opacity-50 pointer-events-none"}`}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Call {seniorName || "Senior"}</p>
              <p className="text-xs text-muted-foreground">Phone call</p>
            </div>
          </a>
          <a
            href={smsLink || "#"}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${smsLink ? "border-border/50 hover:bg-muted/30" : "border-border/30 opacity-50 pointer-events-none"}`}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Send Reassurance Text</p>
              <p className="text-xs text-muted-foreground">Pre-written message</p>
            </div>
          </a>
          <a
            href="https://reportfraud.ftc.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Flag className="w-4 h-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Report to Authorities</p>
              <p className="text-xs text-muted-foreground">File a scam report</p>
            </div>
          </a>
          <button
            onClick={handleShare}
            className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{shareCopied ? "Copied!" : "Share Alert"}</p>
              <p className="text-xs text-muted-foreground">{shareCopied ? "Summary copied" : "Send to family"}</p>
            </div>
          </button>
        </div>
        {!seniorPhone && analysis.senior_id && (
          <p className="text-xs text-muted-foreground">No phone number saved — add one in the Family page to enable call & text actions.</p>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
        <h3 className="font-semibold font-heading">Guardian Actions</h3>

        <div className="grid grid-cols-2 gap-3">
          {analysis.guardian_status !== "handled" ? (
            <Button onClick={handleMarkHandled} disabled={saving} className="gap-2 bg-success hover:bg-success/90 h-11">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark Resolved
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 bg-success/10 text-success rounded-xl h-11 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Resolved
            </div>
          )}
          {warningSent ? (
            <div className="flex items-center justify-center gap-2 bg-primary/10 text-primary rounded-xl h-11 text-sm font-medium">
              <Send className="w-4 h-4" /> Warning Sent
            </div>
          ) : (
            <Button variant="outline" onClick={handleSendWarning} disabled={sendingWarning || !seniorEmail} className="gap-2 h-11">
              {sendingWarning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Warning
            </Button>
          )}
        </div>
        {warningError && <p className="text-xs text-destructive">{warningError}</p>}
        {!seniorEmail && analysis.senior_id && <p className="text-xs text-muted-foreground">Could not find family member's email.</p>}
        {!analysis.senior_id && <p className="text-xs text-muted-foreground">No family member linked to this alert.</p>}

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this alert..."
            className="resize-none rounded-xl"
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveNotes} disabled={saving} className="gap-2">
            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}