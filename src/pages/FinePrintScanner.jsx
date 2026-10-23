import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Loader2, AlertTriangle, Crown, History, Copy, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import DocumentInput from "@/components/fineprint/DocumentInput";
import FinePrintResults from "@/components/fineprint/FinePrintResults";
import { documentTypeLabel, normalizeLevel } from "@/components/fineprint/riskLevels";

const FREE_MONTHLY_SCANS = 3;

function isTextFile(file) {
  return file.type?.startsWith("text/") || /\.(txt|md|text)$/i.test(file.name || "");
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => reject(new Error("We could not read that file. Please try a different one."));
    reader.readAsText(file);
  });
}

function buildReportText(analysis, meta) {
  const lines = [];
  lines.push("VARDIN FINE PRINT REPORT");
  if (meta?.documentType) lines.push(`Document: ${meta.documentType}`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  lines.push(`Risk: ${analysis.risk_score}/100`);
  lines.push("");
  if (analysis.summary) {
    lines.push("WHAT YOU ARE AGREEING TO");
    lines.push(analysis.summary);
    lines.push("");
  }
  if (analysis.red_flags?.length) {
    lines.push("THINGS TO WATCH OUT FOR");
    analysis.red_flags.forEach((flag, index) => {
      lines.push(`${index + 1}. ${flag.title} (${flag.severity || "medium"})`);
      if (flag.exact_quote) lines.push(`   Quote: "${flag.exact_quote}"`);
      if (flag.plain_explanation) lines.push(`   Why it matters: ${flag.plain_explanation}`);
      if (flag.suggested_action) lines.push(`   What you can do: ${flag.suggested_action}`);
    });
    lines.push("");
  }
  if (analysis.key_terms?.length) {
    lines.push("KEY TERMS");
    analysis.key_terms.forEach((term) => {
      if (typeof term === "string") lines.push(`- ${term}`);
      else lines.push(`- ${term.label || term.term}: ${term.detail || term.value || ""}`);
    });
    lines.push("");
  }
  if (analysis.missing_info?.length) {
    lines.push("WHAT THIS DOCUMENT LEAVES OUT");
    analysis.missing_info.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }
  if (analysis.questions_to_ask?.length) {
    lines.push("QUESTIONS TO ASK BEFORE YOU SIGN");
    analysis.questions_to_ask.forEach((question, index) => lines.push(`${index + 1}. ${question}`));
    lines.push("");
  }
  lines.push("This is an AI-generated summary for information only, not legal advice. For important decisions, consult a qualified professional.");
  return lines.join("\n");
}

export default function FinePrintScanner() {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState("auto");
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [resultType, setResultType] = useState("auto");
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false);
  const [usage, setUsage] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadUsage = async () => {
    try {
      const user = await base44.auth.me();
      const isPaid = ["plus", "premium", "elite"].includes(user?.subscription_plan);
      if (isPaid) {
        setUsage({ used: null, limit: null });
        return;
      }
      const scans = await base44.entities.ScanHistory.list("-created_date", 100);
      const month = new Date().toISOString().slice(0, 7);
      const used = scans.filter((scan) => String(scan.created_date || "").slice(0, 7) === month).length;
      setUsage({ used, limit: FREE_MONTHLY_SCANS });
      if (used >= FREE_MONTHLY_SCANS) setLimited(true);
    } catch {
      // Usage display is optional; the server enforces the real limit.
    }
  };

  useEffect(() => {
    loadUsage();
  }, []);

  const reset = () => {
    setAnalysis(null);
    setTruncated(false);
    setError("");
    setCopied(false);
  };

  const handleScan = async () => {
    setError("");
    setCopied(false);

    let documentText = text.trim();
    if (!documentText && !file) {
      setError("Paste your document text or upload a file first.");
      return;
    }
    if (documentText && documentText.length < 100) {
      setError("There is too little text to analyze. Paste at least a few paragraphs of the actual terms.");
      return;
    }

    setScanning(true);
    setAnalysis(null);
    setTruncated(false);

    try {
      let fileUri = "";
      if (!documentText && file) {
        if (isTextFile(file)) {
          documentText = (await readTextFile(file)).trim();
        } else {
          const upload = await base44.integrations.Core.UploadPrivateFile({ file });
          fileUri = upload?.file_uri || "";
          if (!fileUri) throw new Error("We could not upload that file. Please try again.");
        }
      }

      const response = await base44.functions.invoke("analyzeDocument", {
        document_text: documentText,
        file_uri: fileUri,
        file_name: file?.name || "",
        document_type: documentType,
        language: localStorage.getItem("vardin_language") || "en",
      });
      const data = response?.data || response;

      if (data?.limited) {
        setLimited(true);
        setUsage({ used: data.scans_used ?? FREE_MONTHLY_SCANS, limit: data.scan_limit ?? FREE_MONTHLY_SCANS });
        return;
      }
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setResultType(data.document_type_label || documentTypeLabel(data.document_type));
      setTruncated(!!data.truncated);
      if (data.scan_limit) {
        setUsage({ used: data.scans_used || 1, limit: data.scan_limit });
        // Show the friendly upgrade note as soon as the last free scan is used up.
        if ((data.scans_used || 0) >= data.scan_limit) setLimited(true);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e?.message || "Something went wrong while reading the document. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReportText(analysis, { documentType: resultType }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying did not work on this device. You can select the text instead.");
    }
  };

  const riskConfig = analysis ? normalizeLevel(analysis.risk_level, analysis.risk_score) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ScrollText className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Fine Print Scanner</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
          Contracts, leases, subscriptions and bills explained in plain language, with anything risky flagged before you sign.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
        <Link to="/my-scans" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <History className="w-4 h-4" />
          My Scans
        </Link>
        {usage?.limit && usage.used != null && (
          <span className="text-muted-foreground">
            {Math.max(0, usage.limit - usage.used)} of {usage.limit} free scans left this month
          </span>
        )}
      </div>

      {limited && !analysis && (
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5 sm:p-6 space-y-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-primary flex-shrink-0" />
            <h2 className="font-semibold font-heading">You have used your 3 free scans this month</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your reports are safe in My Scans. Upgrade to Plus or Premium for unlimited document scans, or come back next month for 3 more free ones.
          </p>
          <Button asChild className="w-full sm:w-auto h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80">
            <Link to="/pricing">See plans</Link>
          </Button>
        </div>
      )}

      {!analysis && !scanning && !limited && (
        <div className="animate-slide-up anim-delay-1">
          <DocumentInput
            text={text}
            onTextChange={setText}
            file={file}
            onFileChange={setFile}
            documentType={documentType}
            onDocumentTypeChange={setDocumentType}
            onScan={handleScan}
            scanning={scanning}
          />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {scanning && (
        <div className="rounded-3xl border border-border/50 bg-card p-8 sm:p-10 text-center space-y-3 animate-fade-in">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="font-medium">Reading the fine print…</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Checking costs, renewal, cancellation terms and anything that limits your rights.
          </p>
        </div>
      )}

      {analysis && riskConfig && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{resultType}</span>
            {truncated && (
              <span className="text-xs text-muted-foreground">Long document: only the beginning was checked</span>
            )}
          </div>
          <FinePrintResults
            analysis={analysis}
            actions={
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleCopy} className="h-11 rounded-xl gap-2 flex-1">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy Report"}
                </Button>
                <Button variant="outline" onClick={reset} className="h-11 rounded-xl flex-1">
                  Scan Another Document
                </Button>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}