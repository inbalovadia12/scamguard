import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ScrollText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import FinePrintResults from "@/components/fineprint/FinePrintResults";
import { documentTypeLabel } from "@/components/fineprint/riskLevels";

export default function ScanDetail() {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const record = await base44.entities.ScanHistory.get(id);
        if (!cancelled) setScan(record);
      } catch {
        if (!cancelled) setScan(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const analysis = useMemo(() => {
    try {
      return JSON.parse(scan?.results_json || "{}");
    } catch {
      return null;
    }
  }, [scan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!scan || !analysis) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-4">
        <ScrollText className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-medium">That scan could not be found.</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/fine-print">Back to My Scans</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/fine-print" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          My Scans
        </Link>
        {scan.created_date && (
          <span className="text-xs text-muted-foreground">{new Date(scan.created_date).toLocaleString()}</span>
        )}
      </div>

      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-heading break-words">
          {scan.title || documentTypeLabel(scan.document_type)}
        </h1>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{documentTypeLabel(scan.document_type)}</p>
      </div>

      <FinePrintResults
        analysis={analysis}
        actions={
          <Button asChild variant="outline" className="w-full h-11 rounded-xl">
            <Link to="/fine-print">Scan another document</Link>
          </Button>
        }
      />
    </div>
  );
}