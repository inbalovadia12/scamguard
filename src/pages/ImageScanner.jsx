import React, { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, Upload, Loader2, AlertTriangle, ExternalLink, ShieldAlert, Zap, X } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RISK_META } from "@/components/scam/ScamReportCard";
import { getCreditStatus } from "@/lib/credits";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import CommunityIntel from "@/components/community/CommunityIntel";
import AIDisclaimer from "@/components/AIDisclaimer";

const USE_CASES = [
  { value: "romance", label: "Romance Scam", desc: "Dating app profile photo" },
  { value: "marketplace", label: "Marketplace", desc: "Seller profile photo" },
  { value: "business", label: "Fake Business", desc: "Business or professional" },
  { value: "general", label: "General", desc: "Any suspicious photo" },
];

const USE_CASE_TO_SCAM = {
  romance: "romance",
  marketplace: "marketplace",
};

const CREDIT_COST = 10;

export default function ImageScanner() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [useCase, setUseCase] = useState("romance");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const imageUrl = uploadRes.file_url;

      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("scanImage", {
        image_url: imageUrl,
        use_case: useCase,
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      const r = response.data?.result;
      setResult({
        image_url: imageUrl,
        risk_level: r.risk_level,
        risk_score: r.risk_score,
        is_likely_scam_profile: r.is_likely_scam_profile,
        explanation: r.explanation,
        similar_images_found: r.similar_images_found || [],
        sources: r.sources || [],
        red_flags: r.red_flags || [],
        created_date: new Date().toISOString(),
      });
      if (response.data?.credits_remaining != null) {
        setCredits((prev) => (prev ? { ...prev, remaining: response.data.credits_remaining } : prev));
      }
    } catch (e) {
      setError(e.message || "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const canScan = credits && credits.remaining >= CREDIT_COST;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <ImageIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Reverse Image Scam Detector</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Upload a profile photo to check if it appears elsewhere online or resembles common scam profiles.
        </p>
      </div>

      {/* Use case selector */}
      <div className="animate-slide-up" style={{ animationDelay: "30ms" }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">What are you checking?</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {USE_CASES.map((uc) => (
            <button
              key={uc.value}
              onClick={() => setUseCase(uc.value)}
              className={`p-3 rounded-xl border text-left transition-all ${
                useCase === uc.value
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/50 bg-card hover:bg-muted/30"
              }`}
            >
              <p className="text-sm font-medium">{uc.label}</p>
              <p className="text-xs text-muted-foreground">{uc.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        {!previewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileSelect({ target: { files: [file] } });
            }}
            className={`w-full border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-3 cursor-pointer transition-all ${
              dragOver ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Click or drag a photo here</p>
              <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG up to 10MB</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <img src={previewUrl} alt="Preview" className="w-full max-h-80 object-contain rounded-xl" />
            <button
              onClick={handleClearImage}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {selectedFile && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5" />
              <span>Costs {CREDIT_COST} credits</span>
              {credits && <span>· {credits.remaining} remaining</span>}
            </div>
            <Button onClick={handleScan} disabled={scanning || !canScan} className="gap-2">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              {scanning ? "Scanning..." : "Scan Image"}
            </Button>
          </div>
        )}

        {credits && !canScan && selectedFile && (
          <div className="flex items-center justify-between gap-3 bg-destructive/5 border border-destructive/20 rounded-xl p-3">
            <p className="text-xs text-destructive">Not enough credits. You need {CREDIT_COST} but have {credits.remaining}.</p>
            <Button size="sm" asChild>
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </div>
        )}
      </div>

      <AIDisclaimer className="animate-slide-up" style={{ animationDelay: "70ms" }} />

      {/* Loading state */}
      {scanning && <LongLoadingScreen type="image" />}

      {/* Result */}
      {!scanning && result && <ImageScanResult data={result} previewUrl={previewUrl} />}
    </div>
  );
}

function ImageScanResult({ data, previewUrl }) {
  const risk = RISK_META[data.risk_level] || RISK_META.medium;
  const score = data.risk_score || 0;
  const scoreColor = score >= 71 ? "text-destructive" : score >= 31 ? "text-warning" : "text-success";
  const barColor = score >= 71 ? "bg-destructive" : score >= 31 ? "bg-warning" : "bg-success";

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-5 animate-slide-up">
      <div className="flex gap-4">
        {previewUrl && (
          <img src={previewUrl} alt="Analyzed" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2 min-w-0">
          {data.is_likely_scam_profile !== undefined && (
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${data.is_likely_scam_profile ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              {data.is_likely_scam_profile ? <AlertTriangle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
              {data.is_likely_scam_profile ? "Likely scam profile" : "Likely genuine"}
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Score</span>
              <span className={`text-2xl font-bold ${scoreColor}`}>
                {score}<span className="text-sm text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${score}%` }} />
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{data.explanation}</p>

      {data.red_flags?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Red Flags</p>
          <div className="space-y-1.5">
            {data.red_flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-destructive/60" />
                <span className="leading-relaxed">{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.similar_images_found?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Similar Images Found</p>
          <div className="space-y-1.5">
            {data.similar_images_found.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 flex-shrink-0" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.sources?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sources</p>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((source, i) => (
              <a key={i} href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">
                {source}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Community Intel */}
      {USE_CASE_TO_SCAM[data.use_case] && (
        <div className="border-t border-border/50 pt-4">
          <CommunityIntel scamTypes={[USE_CASE_TO_SCAM[data.use_case]]} />
        </div>
      )}
    </div>
  );
}