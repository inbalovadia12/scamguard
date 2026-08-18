import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, Mail, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, ListPlus,
  Download, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { getCreditStatus, incrementCreditUsage, CREDIT_COSTS } from "@/lib/credits";
import PlanGate from "@/components/PlanGate";
import { toast } from "@/components/ui/use-toast";

const MAX_CONCURRENCY = 3;
const MAX_ITEMS = 20;
const PHONE_COST = 5;
const MESSAGE_COST = CREDIT_COSTS.MESSAGE; // 3

const RISK_META = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "Low Risk" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Medium Risk" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "High Risk" },
};

const MESSAGE_SCHEMA = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number", description: "0-100 risk score. Low 0-35, Medium 36-70, High 71-100." },
    explanation: { type: "string" },
    tactics_detected: { type: "array", items: { type: "string" } },
  },
};

function parsePhoneNumbers(text) {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[^\d]/g, "").length >= 7)
    .slice(0, MAX_ITEMS);
}

function parseMessages(text) {
  return text
    .split(/\n---\n|\n{3,}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10)
    .slice(0, MAX_ITEMS);
}

export default function BulkPhoneScanner({ credits: initialCredits, onCreditsChange }) {
  const [bulkType, setBulkType] = useState("phone");
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [credits, setCredits] = useState(initialCredits);
  const cancelRef = useRef(false);

  useEffect(() => {
    setCredits(initialCredits);
  }, [initialCredits]);

  const updateCredits = async () => {
    const updated = await getCreditStatus();
    setCredits(updated);
    if (onCreditsChange) onCreditsChange(updated);
  };

  const detected = bulkType === "phone" ? parsePhoneNumbers(input) : parseMessages(input);
  const costPerItem = bulkType === "phone" ? PHONE_COST : MESSAGE_COST;
  const totalCost = detected.length * costPerItem;

  const handleScan = async () => {
    const entries = bulkType === "phone" ? parsePhoneNumbers(input) : parseMessages(input);
    if (entries.length === 0) return;

    if (credits && credits.remaining < totalCost) {
      toast({
        title: "Not enough credits",
        description: `You need ${totalCost} credits (${entries.length} × ${costPerItem}) but have ${credits.remaining}.`,
        variant: "destructive",
      });
      return;
    }

    // Deduct credits upfront
    await incrementCreditUsage(totalCost);
    await updateCredits();

    setScanning(true);
    cancelRef.current = false;

    const initialItems = entries.map((e) => ({ input: e, status: "pending", result: null, error: null }));
    setItems(initialItems);
    setCompletedCount(0);
    setExpandedIndex(null);

    const lang = localStorage.getItem("vardin_language") || "en";
    let doneCount = 0;
    let idx = 0;

    const scanPhone = async (number) => {
      const response = await base44.functions.invoke("lookupPhoneNumber", { phone_number: number, language: lang });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data?.result;
    };

    const scanMessage = async (text) => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Scam detection expert: analyze this message for scam risk.\nMessage: "${text}"\nRules: never say "definitely a scam" (use "likely"); plain English; educational. Name manipulation tactics and concrete next steps.\nRISK SCORE: 0-100 whole number. Low 0-35, Medium 36-70, High 71-100. Must match risk_level.`,
        response_json_schema: MESSAGE_SCHEMA,
      });
      return result;
    };

    const runWorker = async () => {
      while (idx < entries.length) {
        if (cancelRef.current) return;
        const myIdx = idx++;
        setItems((prev) => prev.map((it, i) => (i === myIdx ? { ...it, status: "scanning" } : it)));

        try {
          const result = bulkType === "phone" ? await scanPhone(entries[myIdx]) : await scanMessage(entries[myIdx]);
          setItems((prev) => prev.map((it, i) => (i === myIdx ? { ...it, status: "done", result } : it)));
        } catch (e) {
          setItems((prev) => prev.map((it, i) => (i === myIdx ? { ...it, status: "error", error: e.message } : it)));
        }
        doneCount++;
        setCompletedCount(doneCount);
      }
    };

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, entries.length) }, () => runWorker());
    await Promise.all(workers);
    setScanning(false);
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setScanning(false);
    setItems((prev) => prev.map((it) => (it.status === "pending" || it.status === "scanning" ? { ...it, status: "cancelled" } : it)));
  };

  const handleClear = () => {
    setInput("");
    setItems([]);
    setCompletedCount(0);
    setExpandedIndex(null);
  };

  const handleExport = () => {
    const done = items.filter((it) => it.status === "done" && it.result);
    if (done.length === 0) return;
    const headers = bulkType === "phone"
      ? "Phone Number,Risk Score,Risk Level,Country,Carrier,Scam Reports,Summary"
      : "Message,Risk Score,Risk Level,Explanation,Tactics";
    const csv = [headers];
    done.forEach((it) => {
      const r = it.result;
      const esc = (s) => `"${String(s || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
      if (bulkType === "phone") {
        csv.push([esc(it.input), r.reputation_score, r.risk_level, esc(r.country), esc(r.carrier), r.scam_report_count || 0, esc(r.summary)].join(","));
      } else {
        csv.push([esc(it.input.slice(0, 200)), r.risk_score, r.risk_level, esc(r.explanation), esc((r.tactics_detected || []).join("; "))].join(","));
      }
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vardin-bulk-scan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!credits) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!credits.isPaid) {
    return (
      <PlanGate
        icon={ListPlus}
        title="Bulk Scanner"
        description="Check multiple phone numbers or messages at once. Each item is scanned for scam risk with live results streaming in. Available on Plus and Premium plans."
        plan="Plus"
      />
    );
  }

  const total = items.length;
  const done = completedCount;
  const progress = total > 0 ? (done / total) * 100 : 0;

  const order = { done: 0, scanning: 1, pending: 2, error: 3, cancelled: 4 };
  const sortedItems = [...items].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === "done" && b.status === "done") {
      const aScore = bulkType === "phone" ? a.result?.reputation_score : a.result?.risk_score;
      const bScore = bulkType === "phone" ? b.result?.reputation_score : b.result?.risk_score;
      return (bScore || 0) - (aScore || 0);
    }
    return 0;
  });

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ListPlus className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Bulk Scanner</h2>
        <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto hidden sm:block">
          Check multiple phone numbers or messages at once. Results stream in as each item is scanned.
        </p>
      </div>

      <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-7 space-y-4 animate-slide-up anim-delay-2">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
          <button
            onClick={() => !scanning && setBulkType("phone")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${bulkType === "phone" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <Phone className="w-4 h-4" />
            Phone Numbers
          </button>
          <button
            onClick={() => !scanning && setBulkType("message")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${bulkType === "message" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <Mail className="w-4 h-4" />
            Messages / Emails
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              {bulkType === "phone" ? "Paste phone numbers" : "Paste messages or emails"}
            </label>
            <span className="text-xs text-muted-foreground">
              {detected.length}/{MAX_ITEMS} detected
            </span>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={bulkType === "phone"
              ? "Paste numbers (one per line or comma-separated):\n+1-555-123-4567\n+44 20 7946 0958\n(555) 987-6543"
              : "Paste messages separated by --- or blank lines:\n\nDear customer, your package is held at customs. Pay $2 fee...\n\n---\n\nHi! I'm a crypto investor offering guaranteed returns...\n\n---\n\nYour bank account is suspended. Click here to verify..."}
            className="min-h-[120px] sm:min-h-[160px] text-base resize-none rounded-xl"
            disabled={scanning}
          />
          <p className="text-xs text-muted-foreground">
            {bulkType === "phone"
              ? `Up to ${MAX_ITEMS} numbers · ${PHONE_COST} credits each · ${MAX_CONCURRENCY} scanned at a time`
              : `Up to ${MAX_ITEMS} messages · ${MESSAGE_COST} credits each · separate with --- or blank lines`}
          </p>
        </div>

        {/* Cost summary */}
        {detected.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Total cost</span>
            <span className={`font-semibold ${credits.remaining < totalCost ? "text-destructive" : "text-foreground"}`}>
              {totalCost} credits ({credits.remaining} available)
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!scanning ? (
            <>
              <Button
                onClick={handleScan}
                disabled={detected.length === 0 || (credits.remaining < totalCost)}
                className="flex-1 h-11 sm:h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20"
                size="lg"
              >
                {bulkType === "phone" ? <Phone className="w-5 h-5 mr-2" /> : <Mail className="w-5 h-5 mr-2" />}
                Scan {detected.length} {bulkType === "phone" ? "Number" : "Message"}{detected.length !== 1 ? "s" : ""}
              </Button>
              {items.length > 0 && (
                <Button onClick={handleClear} variant="outline" className="h-11 sm:h-12 px-4">
                  Clear
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleCancel} variant="destructive" className="flex-1 h-11 sm:h-12 text-base font-semibold rounded-xl" size="lg">
              <X className="w-5 h-5 mr-2" />
              Stop Scanning
            </Button>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5 space-y-4 animate-slide-up">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{scanning ? "Scanning in background..." : "Scan complete"}</span>
              <span className="text-muted-foreground">{done}/{total} done</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {done > 0 && !scanning && (
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}

          {/* Results */}
          <div className="space-y-2">
            {sortedItems.map((it) => {
              const originalIndex = items.indexOf(it);
              const isExpanded = expandedIndex === originalIndex;

              if (it.status === "pending" || it.status === "scanning" || it.status === "cancelled") {
                return (
                  <div key={originalIndex} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30">
                    {it.status === "scanning" ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                    ) : it.status === "cancelled" ? (
                      <X className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                    )}
                    <span className="text-sm truncate flex-1">{bulkType === "phone" ? it.input : it.input.slice(0, 80) + (it.input.length > 80 ? "…" : "")}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {it.status === "scanning" ? "Scanning..." : it.status === "cancelled" ? "Cancelled" : "Waiting..."}
                    </span>
                  </div>
                );
              }

              if (it.status === "error") {
                return (
                  <div key={originalIndex} className="flex items-center gap-3 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{bulkType === "phone" ? it.input : it.input.slice(0, 80) + (it.input.length > 80 ? "…" : "")}</span>
                    <span className="text-xs text-destructive truncate max-w-[180px]">{it.error}</span>
                  </div>
                );
              }

              // Done
              const r = it.result;
              const risk = RISK_META[r.risk_level] || RISK_META.low;
              const RiskIcon = risk.icon;
              const score = bulkType === "phone" ? (r.reputation_score || 0) : (r.risk_score || 0);
              const displayInput = bulkType === "phone" ? it.input : (it.input.slice(0, 80) + (it.input.length > 80 ? "…" : ""));

              return (
                <div key={originalIndex} className={`rounded-xl border ${risk.border} ${risk.bg} overflow-hidden`}>
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : originalIndex)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <RiskIcon className={`w-5 h-5 ${risk.color} flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{displayInput}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {bulkType === "phone"
                          ? `${r.carrier || "Unknown carrier"}${r.country ? ` · ${r.country}` : ""}${r.scam_report_count > 0 ? ` · ${r.scam_report_count} scam reports` : ""}`
                          : (r.explanation || "").slice(0, 100) + (r.explanation?.length > 100 ? "…" : "")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${risk.color}`}>{score}</span>
                      <span className="text-xs text-muted-foreground">/100</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                      {bulkType === "phone" ? (
                        <>
                          {r.summary && <p className="text-sm text-muted-foreground leading-relaxed">{r.summary}</p>}
                          {r.scam_categories?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {r.scam_categories.map((cat, i) => (
                                <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{cat}</span>
                              ))}
                            </div>
                          )}
                          {r.sources?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {r.sources.slice(0, 4).map((source, i) => (
                                <a key={i} href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">{source}</a>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {r.explanation && <p className="text-sm text-muted-foreground leading-relaxed">{r.explanation}</p>}
                          {r.tactics_detected?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {r.tactics_detected.map((tactic, i) => (
                                <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">{tactic}</span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}