import React from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2, ChevronRight, ScrollText } from "lucide-react";
import { documentTypeLabel, normalizeLevel } from "@/components/fineprint/riskLevels";

export default function ScanHistoryRow({ scan, deleting, onDelete }) {
  const config = normalizeLevel(scan.risk_level, scan.risk_score);

  return (
    <div className="flex items-center gap-2 bg-card rounded-2xl border border-border/50 p-3 sm:p-4">
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
        onClick={() => onDelete(scan.id)}
        disabled={deleting}
        className="p-2 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 disabled:opacity-50"
        aria-label="Delete scan"
      >
        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  );
}