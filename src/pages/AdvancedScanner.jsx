import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, ShieldCheck, Lock, Crown, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { getCreditStatus } from "@/lib/credits";
import ScanTypeGrid, { SCAN_TYPES, ANSWER_TYPES, getScanCost } from "@/components/scam/ScanTypeGrid";
import FileDropzone from "@/components/scam/FileDropzone";
import AdvancedScanResults from "@/components/scam/AdvancedScanResults";

export default function AdvancedScanner() {
  const { lang } = useI18n();
  const [scanType, setScanType] = useState("page");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [answerType, setAnswerType] = useState("detailed");
  const [customFocus, setCustomFocus] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const selectedType = SCAN_TYPES.find((t) => t.value === scanType);
  const cost = getScanCost(scanType, answerType);
  const outOfCredits = credits && !credits.canAnalyze;
  const isPaid = credits?.isPaid;
  const insufficientCredits = credits && credits.remaining > 0 && credits.remaining < cost;

  const canScan = () => {
    if (!selectedType) return false;
    if (selectedType.inputType === "textarea") return text.trim().length > 0;
    if (selectedType.inputType === "url") return url.trim().length > 0;
    if (selectedType.inputType === "image" || selectedType.inputType === "file") return !!fileData;
    return false;
  };

  const resetInputs = () => {
    setText(""); setUrl(""); setFileData(null); setFileName(""); setCustomFocus("");
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        page_text: "",
        screenshot_data_url: "",
        file_data: null,
        file_name: "",
        page_url: "",
        options: {
          scan_type: scanType,
          scan_mode: scanType === "page" ? "text" : scanType,
          answer_type: answerType,
          custom_focus: customFocus.trim(),
          language: lang || "en",
        },
      };
      if (selectedType.inputType === "textarea") payload.page_text = text.trim();
      if (selectedType.inputType === "url") payload.page_url = url.trim();
      if (selectedType.inputType === "image") payload.screenshot_data_url = fileData;
      if (selectedType.inputType === "file") { payload.file_data = fileData; payload.file_name = fileName; }

      const response = await base44.functions.invoke("scanWebpage", payload);
      const data = response.data;
      if (data.credits_remaining != null) {
        setCredits((prev) => ({ ...prev, remaining: data.credits_remaining, limit: data.credits_limit }));
      }
      setResult(data);
    } catch (err) {
      const status = err.response?.status;
      const errData = err.response?.data;
      if (status === 402 && errData) {
        setCredits((prev) => ({ ...prev, remaining: errData.credits_remaining || 0, limit: errData.credits_limit || 0 }));
        setError("Not enough credits for this scan.");
      } else if (status === 403) {
        setError("Premium subscription required for this feature.");
      } else {
        setError(errData?.error || err.message || "Scan failed. Please try again.");
      }
    } finally {
      setScanning(false);
    }
  };

  const handleRescan = () => {
    setResult(null);
    setError(null);
    resetInputs();
  };

  // Premium gate
  if (credits && !isPaid) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center space-y-3 mb-8 animate-slide-up">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Advanced Scanner</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            All-in-one scam detection: pages, URLs, screenshots, QR codes, emails, chats, marketplace listings, and files.
          </p>
        </div>
        <div className="p-8 rounded-3xl border border-border/50 bg-card text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-warning/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-warning" />
          </div>
          <h3 className="font-semibold text-lg">Premium Feature</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The Advanced Scanner is available on Plus and Premium plans. Upgrade to access all scan types, VirusTotal integration, and detailed reports.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              <Crown className="w-4 h-4" />
              Upgrade to Unlock
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2 mb-6 animate-slide-up">
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Advanced Scanner</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto hidden sm:block">
          All extension scan types in one place — pages, URLs, screenshots, QR codes, emails, chats, marketplace listings, and files.
        </p>
      </div>

      {result ? (
        <div className="space-y-6 animate-scale-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading">Scan Result</h2>
            <Button variant="outline" onClick={handleRescan}>New Scan</Button>
          </div>
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6">
            <AdvancedScanResults data={result} onRescan={handleRescan} />
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-slide-up anim-delay-1">
          {/* Credits bar */}
          {credits && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted rounded-xl">
              <span className="text-sm text-muted-foreground">
                ✦ {credits.plan === "premium" ? "Premium" : "Plus"} plan
              </span>
              <span className="text-sm font-medium">{credits.remaining} / {credits.limit} credits left</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
              {error.includes("credit") && (
                <Link to="/pricing" className="ml-auto flex-shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10">
                    <Crown className="w-3.5 h-3.5" />Upgrade
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Scan Type Grid */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6 space-y-5">
            <div>
              <label className="text-sm font-medium mb-2 block">Scan Type</label>
              <ScanTypeGrid
                value={scanType}
                onChange={(v) => { setScanType(v); resetInputs(); setError(null); }}
              />
            </div>

            {/* Input area */}
            <div className="space-y-2">
              {selectedType?.inputType === "textarea" && (
                <>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      scanType === "email" ? "Paste the email content here..." :
                      scanType === "chat" ? "Paste the chat or SMS messages here..." :
                      scanType === "marketplace" ? "Paste the marketplace listing here..." :
                      "Paste the webpage content here..."
                    }
                    className="min-h-[120px] text-base resize-none rounded-xl"
                  />
                </>
              )}
              {selectedType?.inputType === "url" && (
                <>
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://suspicious-link.com"
                    className="h-11 text-base rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Includes VirusTotal reputation check across 70+ security engines.</p>
                </>
              )}
              {selectedType?.inputType === "image" && (
                <FileDropzone
                  onFileSelect={(data, name) => { setFileData(data); setFileName(name); }}
                  accept="image/*"
                  label={scanType === "qr" ? "Upload QR code image" : "Upload screenshot image"}
                  sublabel="PNG, JPG, WebP — max 10MB"
                />
              )}
              {selectedType?.inputType === "file" && (
                <FileDropzone
                  onFileSelect={(data, name) => { setFileData(data); setFileName(name); }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.jpg,.jpeg,.png,.webp"
                  label="Upload file to analyze"
                  sublabel="PDF, DOC, XLS, ZIP, images — max 10MB"
                />
              )}
            </div>

            {/* Result Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Result Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ANSWER_TYPES.map((at) => (
                  <button
                    key={at.value}
                    onClick={() => setAnswerType(at.value)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${answerType === at.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {at.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Focus */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Custom Focus <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <Input
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                placeholder='e.g., "Is this a phishing site?"'
                maxLength={500}
                className="rounded-xl"
              />
            </div>

            {/* Scan button */}
            <Button
              onClick={handleScan}
              disabled={!canScan() || scanning || outOfCredits || insufficientCredits}
              className="w-full h-11 sm:h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20"
              size="lg"
            >
              {scanning ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analyzing...</>
              ) : (
                <>Scan · {cost} credits <ArrowRight className="w-5 h-5 ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}