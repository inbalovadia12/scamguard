import React, { useState, useEffect, useCallback } from "react";
import { PhoneCall, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CallGuardLocked from "@/components/call-guard/CallGuardLocked";
import CallGuardSetup from "@/components/call-guard/CallGuardSetup";
import RecentCallsList from "@/components/call-guard/RecentCallsList";
import CallDetailDialog from "@/components/call-guard/CallDetailDialog";
import CallGuardSettings from "@/components/call-guard/CallGuardSettings";

export default function CallGuard() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (me.call_guard_status === "active") {
        try {
          const data = await base44.entities.CallGuardReport.filter(
            { user_id: me.id },
            "-assessed_at",
            20
          );
          setReports(data);
        } catch {
          setReports([]);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isEntitled = user?.call_guard_status === "active";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
      {/* Beta badge */}
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-bold tracking-wider uppercase">
          Beta
        </span>
      </div>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <PhoneCall className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Call Guard</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Call Guard uses an AI voice agent to screen incoming calls on your behalf. The agent answers, asks callers a few quick questions, and sends the call information to Vardin for post-call scam analysis — so you get a clear risk verdict before deciding whether to call back.
        </p>
      </div>

      {!isEntitled ? (
        <CallGuardLocked user={user} />
      ) : (
        <>
          <CallGuardSetup user={user} onUpdate={loadData} />
          <RecentCallsList reports={reports} onSelect={setSelectedReport} />
          <CallGuardSettings
            user={user}
            onUpdate={loadData}
          />
          <CallDetailDialog
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        </>
      )}
    </div>
  );
}