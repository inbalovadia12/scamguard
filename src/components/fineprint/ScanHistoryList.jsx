import React, { useState, useEffect } from "react";
import { Loader2, ScrollText, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ScanHistoryRow from "@/components/fineprint/ScanHistoryRow";

export default function ScanHistoryList({ refreshToken = 0 }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const records = await base44.entities.ScanHistory.list("-created_date", 50);
        if (!cancelled) setScans(Array.isArray(records) ? records : []);
      } catch {
        if (!cancelled) setError("We could not load your past scans. Please refresh the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshToken]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {scans.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-8 text-center space-y-2">
          <ScrollText className="w-7 h-7 mx-auto text-muted-foreground" />
          <p className="font-medium">No scans yet</p>
          <p className="text-sm text-muted-foreground">Scan a lease, subscription or bill and the report will appear here.</p>
        </div>
      ) : (
        scans.map((scan) => (
          <ScanHistoryRow
            key={scan.id}
            scan={scan}
            deleting={deletingId === scan.id}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}