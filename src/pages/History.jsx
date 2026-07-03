import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import RiskBadge from "@/components/scam/RiskBadge";
import { Loader2, History as HistoryIcon, ChevronRight, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function History() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("all");

  useEffect(() => {
    base44.entities.ScamAnalysis.list("-created_date", 50)
      .then((data) => {
        setAnalyses(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = riskFilter === "all" ? analyses : analyses.filter((a) => a.risk_level === riskFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-primary" />
            Analysis History
          </h1>
          <p className="text-muted-foreground mt-1">Your past scam analyses and risk assessments.</p>
        </div>
        {analyses.length > 0 && (
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              <SelectItem value="high">High risk</SelectItem>
              <SelectItem value="medium">Medium risk</SelectItem>
              <SelectItem value="low">Low risk</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No analyses yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Start by checking a suspicious message — your analysis history will appear here.
          </p>
          <Link to="/dashboard" className="inline-block">
            <span className="text-primary font-medium hover:underline text-sm">Check a message →</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card rounded-2xl border border-border/50 p-5 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <RiskBadge riskLevel={item.risk_level} />
                    {item.risk_score != null && (
                      <span className="text-xs font-medium text-muted-foreground">{item.risk_score}/100</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(item.created_date)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">{item.message_text}</p>
              {item.tactics_detected && item.tactics_detected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.tactics_detected.slice(0, 3).map((tactic, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tactic}</span>
                  ))}
                  {item.tactics_detected.length > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{item.tactics_detected.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}