import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Eye, Loader2, Phone } from "lucide-react";
import AnalysisResult from "@/components/scam/AnalysisResult";

export default function AlertDetail() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await base44.entities.ScamAnalysis.get(id);
      setAnalysis(data);
      setNotes(data.guardian_notes || "");
      // Mark as reviewed if new
      if (data.guardian_status === "new") {
        await base44.entities.ScamAnalysis.update(id, { guardian_status: "reviewed" });
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
        <Link to="/alerts" className="text-blue-500 hover:underline mt-2 inline-block">Back to alerts</Link>
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
        <h1 className="text-2xl font-bold tracking-tight">Alert Detail</h1>
      </div>

      {/* Original message */}
      <div className="bg-white rounded-2xl border border-border/50 p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Original message</h3>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.message_text}</p>
      </div>

      {/* Analysis */}
      <div className="bg-white rounded-3xl border border-border/50 shadow-sm p-6">
        <AnalysisResult analysis={analysis} />
      </div>

      {/* Guardian Actions */}
      <div className="bg-white rounded-2xl border border-border/50 p-5 space-y-4">
        <h3 className="font-semibold">Guardian Actions</h3>

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
          {analysis.guardian_status !== "handled" && (
            <Button
              onClick={handleMarkHandled}
              disabled={saving}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark as Handled
            </Button>
          )}
          <Button variant="outline" onClick={handleSaveNotes} disabled={saving} className="gap-2">
            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}