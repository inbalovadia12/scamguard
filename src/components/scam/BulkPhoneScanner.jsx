import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, Mail, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, ListPlus,
  Plus, X, ChevronDown, ChevronUp, Download, Trash2,
} from "lucide-react";
import { getCreditStatus, incrementCreditUsage, CREDIT_COSTS } from "@/lib/credits";
import PlanGate from "@/components/PlanGate";
import { toast } from "@/components/ui/use-toast";

const MAX_ITEMS = 20;
const INITIAL_ITEMS = 3;
const MAX_CONCURRENCY = 3;
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

function makeBox(id) {
  return { id, input: "", status: "idle", result: null, error: null };
}

export default function BulkPhoneScanner({ credits: initialCredits, onCreditsChange }) {
  const [bulkType, setBulkType] = useState("phone");
  const [boxes, setBoxes] = useState(() => Array.from({ length: INITIAL_ITEMS }, (_, i) => makeBox(i)));
  const [scanning, setScanning] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [credits, setCredits] = useState(initialCredits);
  const cancelRef = useRef(false);
  const nextId = useRef(INITIAL_ITEMS);

  useEffect(() => { setCredits(initialCredits); }, [initialCredits]);

  const updateCredits = async () => {
    const updated = await getCreditStatus();
    setCredits(updated);
    if (onCreditsChange) onCreditsChange(updated);
  };

  const handleTypeChange = (type) => {
    if (scanning) return;
    setBulkType(type);
    setBoxes(Array.from({ length: INITIAL_ITEMS }, () => makeBox(nextId.current++)));
    setCompletedCount(0);
    setExpandedId(null);
  };

  const addBox = () => {
    if (boxes.length >= MAX_ITEMS || scanning) return;
    setBoxes(prev => [...prev, makeBox(nextId.current++)]);
  };

  const removeBox = (id) => {
    if (scanning || boxes.length <= 1) return;
    setBoxes(prev => prev.filter(b => b.id !== id));
  };

  const updateInput = (id, value) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, input: value } : b));
  };

  const filledBoxes = boxes.filter(b => b.input.trim().length > 0);
  const costPerItem = bulkType === "phone" ? PHONE_COST : MESSAGE_COST;
  const totalCost = filledBoxes.length * costPerItem;

  const handleScanAll = async () => {
    const toScan = boxes.filter(b => b.input.trim().length > 0);
    if (toScan.length === 0) return;

    if (credits && credits.remaining < totalCost) {
      toast({
        title: "Not enough credits",
        description: `You need ${totalCost} credits (${toScan.length} × ${costPerItem}) but have ${credits.remaining}.`,
        variant: "destructive",
      });
      return;
    }

    await incrementCreditUsage(totalCost);
    await updateCredits();

    setScanning(true);
    cancelRef.current = false;
    setCompletedCount(0);
    setExpandedId(null);

    setBoxes(prev => prev.map(b => b.input.trim().length > 0 ? { ...b, status: "scanning", result: null, error: null } : b));

    const lang = localStorage.getItem("vardin_language") || "en";
    let doneCount = 0;
    let idx = 0;

    const scanPhone = async (number) => {
      const response = await base44.functions.invoke("lookupPhoneNumber", { phone_number: number, language: lang });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data?.result;
    };

    const scanMessage = async (text) => {
      return await base44.integrations.Core.InvokeLLM({
        prompt: `Scam detection expert: analyze this message for scam risk.\nMessage: "${text}"\nRules: never say "definitely a scam" (use "likely"); plain English; educational. Name manipulation tactics and concrete next steps.\nRISK SCORE: 0-100 whole number. Low 0-35, Medium 36-70, High 71-100. Must match risk_level.`,
        response_json_schema: MESSAGE_SCHEMA,
      });
    };

    const runWorker = async () => {
      while (idx < toScan.length) {
        if (cancelRef.current) return;
        const myIdx = idx++;
        const box = toScan[myIdx];
        try {
          const result = bulkType === "phone" ? await scanPhone(box.input.trim()) : await scanMessage(box.input.trim());
          setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, status: "done", result } : b));
        } catch (e) {
          setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, status: "error", error: e.message } : b));
        }
        doneCount++;
        setCompletedCount(doneCount);
      }
    };

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, toScan.length) }, () => runWorker());
    await Promise.all(workers);
    setScanning(false);
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setScanning(false);
    setBoxes(prev => prev.map(b => b.status === "scanning" ? { ...b, status: "idle" } : b));
  };

  const handleClearAll = () => {
    setBoxes(Array.from({ length: INITIAL_ITEMS }, () => makeBox(nextId.current++)));
    setCompletedCount(0);
    setExpandedId(null);
  };

  const handleExport = () => {
    const done = boxes.filter(b => b.status === "done" && b.result);
    if (done.length === 0) return;
    const headers = bulkType === "phone"
      ? "Item,Risk Score,Risk Level,Country,Carrier,Scam Reports,Summary"
      : "Item,Risk Score,Risk Level,Explanation,Tactics";
    const rows = [headers];
    done.forEach((b) => {
      const r = b.result;
      const esc = (s) => `"${String(s || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
      if (bulkType === "phone") {
        rows.push([esc(b.input), r.reputation_score, r.risk_level, esc(r.country), esc(r.carrier), r.scam_report_count || 0, esc(r.summary)].join(","));
      } else {
        rows.push([esc(b.input.slice(0, 200)), r.risk_score, r.risk_level, esc(r.explanation), esc((r.tactics_detected || []).join("; "))].join(","));
      }
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
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
        description="Check multiple phone numbers or messages at once. Add boxes, type or paste your items, and scan them all in one go. Available on Plus and Premium plans."
        plan="Plus"
      />
    );
  }

  const doneCount = boxes.filter(b => b.status === "done").length;
  const hasResults = doneCount > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ListPlus className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Bulk Scanner</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
          Add items to boxes below, then scan them all at once. Results appear in each box.
        </p>
      </div>

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl animate-slide-up anim-delay-1">
        <button
          onClick={() => handleTypeChange("phone")}
          disabled={scanning}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${bulkType === "phone" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          <Phone className="w-4 h-4" />
          Phone Numbers
        </button>
        <button
          onClick={() => handleTypeChange("message")}
          disabled={scanning}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${bulkType === "message" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          <Mail className="w-4 h-4" />
          Messages / Emails
        </button>
      </div>

      {/* Boxes */}
      <div className="space-y-3 animate-slide-up anim-delay-2">
        {boxes.map((box, i) => {
          const risk = box.result ? (RISK_META[box.result.risk_level] || RISK_META.low) : null;
          const RiskIcon = risk?.icon;
          const score = box.result ? (bulkType === "phone" ? box.result.reputation_score : box.result.risk_score) : 0;
          const isExpanded = expandedId === box.id;

          return (
            <div key={box.id} className={`rounded-2xl border ${risk ? risk.border : "border-border/50"} ${risk ? risk.bg : "bg-card"} overflow-hidden transition-all`}>
              {/* Box header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  {bulkType === "phone" ? <Phone className="w-3.5 h-3.5 text-muted-foreground" /> : <Mail className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground font-medium">
                    {bulkType === "phone" ? "Phone number" : "Message / email"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {box.status === "scanning" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                  {box.status === "done" && RiskIcon && <RiskIcon className={`w-4 h-4 ${risk.color}`} />}
                  {box.status === "error" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  {boxes.length > 1 && !scanning && (
                    <button onClick={() => removeBox(box.id)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Input */}
              <div className="p-3">
                <Textarea
                  value={box.input}
                  onChange={(e) => updateInput(box.id, e.target.value)}
                  disabled={scanning}
                  placeholder={bulkType === "phone"
                    ? "Enter a phone number..."
                    : "Paste a message or email to scan..."}
                  className={`min-h-[56px] ${bulkType === "message" ? "sm:min-h-[80px]" : ""} text-sm resize-none rounded-xl border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0`}
                />

                {/* Result */}
                {box.status === "scanning" && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scanning...
                  </div>
                )}

                {box.status === "error" && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {box.error}
                  </div>
                )}

                {box.status === "done" && box.result && risk && (
                  <div className="mt-2 space-y-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : box.id)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${risk.color}`}>{risk.label}</span>
                        <span className="text-xs text-muted-foreground">Score: {score}/100</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="space-y-2 pt-2 border-t border-border/30">
                        {bulkType === "phone" ? (
                          <>
                            {box.result.summary && <p className="text-sm text-muted-foreground leading-relaxed">{box.result.summary}</p>}
                            {box.result.scam_categories?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {box.result.scam_categories.map((cat, ci) => (
                                  <span key={ci} className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{cat}</span>
                                ))}
                              </div>
                            )}
                            {box.result.sources?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {box.result.sources.slice(0, 4).map((source, si) => (
                                  <a key={si} href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">{source}</a>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {box.result.explanation && <p className="text-sm text-muted-foreground leading-relaxed">{box.result.explanation}</p>}
                            {box.result.tactics_detected?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {box.result.tactics_detected.map((tactic, ti) => (
                                  <span key={ti} className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">{tactic}</span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add more button */}
      {boxes.length < MAX_ITEMS && !scanning && (
        <button
          onClick={addBox}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <Plus className="w-4 h-4" />
          Add Another Box
          <span className="text-xs text-muted-foreground/60">({boxes.length}/{MAX_ITEMS})</span>
        </button>
      )}

      {/* Bottom action bar */}
      <div className="sticky bottom-4 bg-card/95 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg p-4 space-y-3 animate-slide-up anim-delay-3">
        {/* Progress */}
        {scanning && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Scanning {completedCount} of {filledBoxes.length}...</span>
              <span>{Math.round((completedCount / filledBoxes.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / filledBoxes.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Cost summary */}
        {filledBoxes.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {filledBoxes.length} {filledBoxes.length === 1 ? "item" : "items"} × {costPerItem} credits
            </span>
            <span className={`font-semibold ${credits.remaining < totalCost ? "text-destructive" : "text-foreground"}`}>
              {totalCost} credits ({credits.remaining} available)
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          {!scanning ? (
            <>
              <Button
                onClick={handleScanAll}
                disabled={filledBoxes.length === 0 || credits.remaining < totalCost}
                className="flex-1 h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20"
                size="lg"
              >
                <ListPlus className="w-5 h-5 mr-2" />
                Scan All {filledBoxes.length > 0 ? `(${filledBoxes.length})` : ""}
              </Button>
              {hasResults && (
                <Button onClick={handleExport} variant="outline" size="lg" className="h-12 px-4 rounded-xl">
                  <Download className="w-4 h-4" />
                </Button>
              )}
              {boxes.some(b => b.input.trim() || b.status !== "idle") && (
                <Button onClick={handleClearAll} variant="ghost" size="lg" className="h-12 px-4 rounded-xl text-muted-foreground">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleCancel} variant="destructive" className="flex-1 h-12 text-base font-semibold rounded-xl" size="lg">
              <X className="w-5 h-5 mr-2" />
              Stop Scanning
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}