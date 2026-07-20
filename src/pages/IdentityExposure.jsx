import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, Crown, AlertTriangle, Upload, X, Fingerprint, ShieldAlert, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { getCreditStatus } from "@/lib/credits";
import IdentityExposureResults from "@/components/scam/IdentityExposureResults";

const CREDIT_COST = 35;

export default function IdentityExposure() {
  const { lang } = useI18n();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fullName, setFullName] = useState("");
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
    const file = e.target?.files?.[0] || (e.dataTransfer && e.dataTransfer.files?.[0]);
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
    if (!selectedFile || !fullName.trim()) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const imageUrl = uploadRes.file_url;

      const response = await base44.functions.invoke("scanIdentityExposure", {
        image_url: imageUrl,
        full_name: fullName.trim(),
        language: lang || "en",
      });
      if (response.data?.error) throw new Error(response.data.error);

      setResult(response.data);
      if (response.data?.credits_remaining != null) {
        setCredits((prev) => (prev ? { ...prev, remaining: response.data.credits_remaining } : prev));
      }
    } catch (e) {
      setError(e.message || "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const isPaid = credits?.isPaid;
  const canScan = credits && credits.remaining >= CREDIT_COST && selectedFile && fullName.trim();

  // Premium gate
  if (credits && !isPaid) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center space-y-3 mb-8 animate-slide-up">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/30">
            <Fingerprint className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Identity Exposure Scanner</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Upload your photo and name — AI searches the internet for every data broker exposing your personal info, with exact opt-out links.
          </p>
        </div>
        <div className="p-8 rounded-3xl border border-border/50 bg-card text-center space-y-4 luxury-card-hover">
          <div className="w-12 h-12 mx-auto rounded-xl bg-warning/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-warning" />
          </div>
          <h3 className="font-semibold text-lg">Premium Feature</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The Identity Exposure Scanner is available on Plus and Premium plans. Upgrade to discover and remove your data from people search sites.
          </p>
          <Link to="/pricing">
            <Button className="gap-2 bg-gradient-to-r from-violet-500 via-primary to-cyan-500">
              <Crown className="w-4 h-4" />
              Upgrade to Unlock
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-primary to-cyan-500 flex items-center justify-center shadow-md shadow-primary/30">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Identity Exposure Scanner</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg">
          Upload a photo of your face and enter your name. AI searches the internet for every data broker and people search site exposing your personal information — with exact opt-out links for each.
        </p>
      </div>

      {result ? (
        <div className="space-y-6 animate-scale-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading">Your Exposure Report</h2>
            <Button variant="outline" onClick={() => { setResult(null); handleClearImage(); setFullName(""); }}>
              New Scan
            </Button>
          </div>
          <IdentityExposureResults data={result} previewUrl={previewUrl} />
        </div>
      ) : (
        <div className="space-y-5 animate-slide-up anim-delay-1">
          {/* Credits bar */}
          {credits && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 via-primary/5 to-cyan-500/10 border border-primary/15">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                {credits.plan === "premium" ? "Premium" : "Plus"} plan
              </span>
              <span className="text-sm font-medium">{credits.remaining} / {credits.limit} credits left</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Upload + Name form */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 sm:p-6 space-y-5 luxury-card-hover">
            {/* Face photo upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">Your Face Photo</label>
              {!previewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e); }}
                  className={`w-full border-2 border-dashed rounded-2xl py-12 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                    dragOver ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Click or drag your photo here</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG up to 10MB</p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain bg-muted/30" />
                  <button
                    onClick={handleClearImage}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Full name input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Your Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., John Smith"
                className="h-11 sm:h-12 text-base rounded-xl"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Use the name people would search for you by — include middle name if you use it publicly.
              </p>
            </div>

            {/* Scan button */}
            <Button
              onClick={handleScan}
              disabled={!canScan || scanning}
              className="w-full h-11 sm:h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-500 via-primary to-cyan-500 shadow-lg shadow-primary/20 border-0"
              size="lg"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Searching the internet...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 mr-2" />
                  Scan My Identity · {CREDIT_COST} credits
                </>
              )}
            </Button>

            {credits && credits.remaining < CREDIT_COST && (
              <div className="flex items-center justify-between gap-3 bg-warning/5 border border-warning/20 rounded-xl p-3">
                <p className="text-xs text-warning">You need {CREDIT_COST} credits but have {credits.remaining}.</p>
                <Button size="sm" asChild>
                  <Link to="/pricing">Upgrade</Link>
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Your photo and name are used only for this scan and never shared.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {scanning && (
        <div className="bg-card rounded-3xl border border-border/50 p-8 flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-muted" />
            <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-violet-500 border-r-primary border-b-cyan-500 animate-spin absolute inset-0" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Searching data brokers...</p>
            <p className="text-xs text-muted-foreground">Scanning people search sites and public records for your identity</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <p className="text-xs text-warning font-medium">Do not switch tabs or close this page while scanning.</p>
          </div>
        </div>
      )}
    </div>
  );
}