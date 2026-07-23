import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Loader2, Send } from "lucide-react";
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
        } catch {
          const seniors = await base44.entities.ProtectedSenior.filter({ senior_user_id: data.senior_id });
          if (seniors.length > 0) {
            setSeniorEmail(seniors[0].email);
            setSeniorName(seniors[0].name || "");
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