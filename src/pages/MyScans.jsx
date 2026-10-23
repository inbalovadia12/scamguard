import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Loader2, Trash2, ChevronRight, History, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { documentTypeLabel, normalizeLevel } from "@/components/fineprint/riskLevels";

export default function MyScans() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const records = await base44.entities.ScanHistory.list("-created_date", 50);
      setScans(Array.isArray(records) ? records : []);
    } catch {
      setError("We could not load your scans. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    setDeletingId(id);
    setError("");
    try {
      await base44.entities.ScanHistory.delete(id);
      setScans((previous) => previous.filter((scan) => scan.id !== id));
    } catch {
      setError("That scan could not be deleted. Please try again.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <History className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">My Scans</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Every document you have scanned, with its report saved.</p>
      </div>

      <div className="flex justify-center">
        <Button asChild className="h-11 rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80">
          <Link to="/fine-print">
            <ScrollText className="w-4 h-4" />
            Scan a document
          </Link>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : scans.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-8 text-center space-y-2">
          <ScrollText className="w-7 h-7 mx-auto text-muted-foreground" />
          <p className="font-medium">No scans yet</p>
          <p className="text-sm text-muted-foreground">Scan a lease, subscription or bill and the report will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {scans.map((scan) => {
            const config = normalizeLevel(scan.risk_level, scan.risk_score);
            return (
              <div key={scan.id} className="flex items-center gap-2 bg-card rounded-2xl border border-border/50 p-3 sm:p-4">
                <Link to={`/my-scans/${scan.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <ScrollText className={`w-4 h-4 ${config.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{scan.title || documentTypeLabel(scan.document_type)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {documentTypeLabel(scan.document_type)}
                      {scan.created_date ? ` · ${new Date(scan.created_date).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.bg} ${config.text} flex-shrink-0`}>
                    {scan.risk_score ?? 0}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(scan.id)}
                  disabled={deletingId === scan.id}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 disabled:opacity-50"
                  aria-label="Delete scan"
                >
                  {deletingId === scan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}