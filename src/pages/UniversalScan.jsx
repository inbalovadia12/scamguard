import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Scan, Image as ImageIcon, X, AlertTriangle,
  ShieldCheck, ShieldAlert, Lightbulb, Target, ThumbsDown,
  RotateCcw, MessageSquare,
} from "lucide-react";

const SCAN_PROMPT = `You are Vardin, an AI scam detection assistant. Analyze the provided content for scam risk.

Detect what the input is: a text message/email, a URL, a phone number, or an image (screenshot/photo).
- URL: assess if it's a phishing or fraudulent site
- Phone number: check if associated with known scams
- Text message/email: analyze for scam tactics and manipulation
- Image: look for scam indicators (fake profiles, phishing pages, fake screenshots, suspicious QR codes)

Respond with:
- risk_level: low (0-35), medium (36-70), high (71-100)
- risk_score: numeric 0-100 based on actual danger level
- explanation: clear plain-English explanation of the assessment
- flagged_phrases: EXACT phrases copied verbatim from the input text that triggered the warning (for highlighting). Only include phrases that appear word-for-word in the text. Empty array if no text or no specific phrases.
- tactics_detected: manipulation tactics detected
- next_steps: specific, actionable steps the user should take RIGHT NOW (this is their action plan)
- what_they_want: what the scammer is trying to obtain
- what_to_say: suggested response, or "Do not respond" if high risk
- input_type: what you detected (message, url, phone_number, image)`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number" },
    explanation: { type: "string" },
    flagged_phrases: { type: "array", items: { type: "string" } },
    tactics_detected: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    what_they_want: { type: "string" },
    what_to_say: { type: "string" },
    input_type: { type: "string" },
  },
};

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "Low Risk — Likely Safe" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Medium Risk — Be Cautious" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "High Risk — Likely Scam" },
};

function detectInputType(text) {
  const trimmed = text.trim();
  if (!trimmed) return "image";
  if (/^https?:\/\//i.test(trimmed) || /^www\.\w+\./i.test(trimmed)) return "url";
  if (/^[+]?[\d\s\-()]{7,}$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 7) return "phone";
  return "message";
}

function HighlightedText({ text, phrases }) {
  if (!text || !phrases || phrases.length === 0) return <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>;
  const valid = phrases.filter((p) => p && p.length > 1).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (valid.length === 0) return <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>;
  const regex = new RegExp(`(${valid.join("|")})`, "gi");
  const parts = text.split(regex);
  return (
    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        const isFlagged = valid.some((v) => new RegExp(`^${v}$`, "i").test(part));
        return isFlagged ? (
          <mark key={i} className="bg-destructive/20 text-destructive rounded px-1 font-medium underline decoration-wavy decoration-destructive/40">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </p>
  );
}

export default function UniversalScan() {
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [markedFP, setMarkedFP] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const fileRef = useRef(null);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    setImages((prev) => [...prev, ...files].slice(0, 2));
  };

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleScan = async () => {
    if (!input.trim() && images.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMarkedFP(false);
    setSavedId(null);

    try {
      let imageUrls = [];
      for (const img of images) {
        const res = await base44.integrations.Core.UploadFile({ file: img });
        imageUrls.push(res.file_url);
      }

      const inputType = detectInputType(input);
      const needsWeb = inputType === "url" || inputType === "phone";

      const prompt = `${SCAN_PROMPT}\n\nUser input:\n${input.trim() || "(images only — no text)"}`;

      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: needsWeb,
        model: needsWeb ? "gemini_3_flash" : undefined,
        response_json_schema: RESPONSE_SCHEMA,
        file_urls: imageUrls.length > 0 ? imageUrls : undefined,
      });

      const saved = await base44.entities.ScamAnalysis.create({
        message_text: input.trim() || "[Image scan]",
        message_type: "other",
        risk_level: llmResult.risk_level || "low",
        risk_score: llmResult.risk_score ?? 0,
        explanation: llmResult.explanation || "",
        tactics_detected: llmResult.tactics_detected || [],
        next_steps: llmResult.next_steps || [],
        what_they_want: llmResult.what_they_want || "",
        what_to_say: llmResult.what_to_say || "",
      });
      setSavedId(saved.id);
      setResult({ ...llmResult, imageUrls, inputType });
    } catch (e) {
      setError(e.message || "Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFalsePositive = async () => {
    if (!savedId) return;
    try {
      await base44.entities.ScamAnalysis.update(savedId, { is_false_positive: true });
      setMarkedFP(true);
    } catch {
      setError("Could not save feedback.");
    }
  };

  const handleReset = () => {
    setInput("");
    setImages([]);
    setResult(null);
    setError(null);
    setMarkedFP(false);
    setSavedId(null);
  };

  const canScan = (input.trim() || images.length > 0) && !loading;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Scan className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Universal Scan</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          One scanner for everything. Paste a message, URL, or phone number — or upload a screenshot. We'll detect the type and analyze it automatically.
        </p>
      </div>

      {/* Input */}
      {!result && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a suspicious message, email, URL, or phone number..."
            className="min-h-[120px] resize-none"
            disabled={loading}
          />

          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50">
                  <img src={URL.createObjectURL(img)} alt="upload" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
              disabled={loading || images.length >= 2}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={loading || images.length >= 2}
              className="gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              {images.length > 0 ? `${images.length}/2 images` : "Add screenshot"}
            </Button>
            <Button
              onClick={handleScan}
              disabled={!canScan}
              className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
              {loading ? "Scanning..." : "Scan Now"}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            We auto-detect URLs, phone numbers, and text messages. Add a screenshot to analyze images.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Risk Badge */}
          {(() => {
            const cfg = RISK_CONFIG[result.risk_level] || RISK_CONFIG.low;
            const RiskIcon = cfg.icon;
            return (
              <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-5 flex items-center gap-4`}>
                <div className={`w-14 h-14 rounded-2xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <RiskIcon className={`w-8 h-8 ${cfg.color}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Risk Score: <span className="font-semibold">{result.risk_score}/100</span>
                    {result.input_type && <span className="capitalize"> · Detected: {result.input_type.replace("_", " ")}</span>}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Images */}
          {result.imageUrls?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {result.imageUrls.map((url, i) => (
                <img key={i} src={url} alt="analyzed" className="w-24 h-24 rounded-lg object-cover border border-border/50" />
              ))}
            </div>
          )}

          {/* Explain the Risk — Highlighted Text */}
          {input.trim() && result.flagged_phrases?.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold">What Triggered the Warning</h3>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
                <HighlightedText text={input} phrases={result.flagged_phrases} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Highlighted phrases are the specific words that raised red flags.
              </p>
            </div>
          )}

          {/* Explanation */}
          {result.explanation && (
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <h3 className="text-sm font-semibold mb-2">Why This Assessment</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.explanation}</p>
            </div>
          )}

          {/* Action Plan */}
          {result.next_steps?.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Your Action Plan</h3>
              </div>
              <div className="space-y-2">
                {result.next_steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground/90 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tactics + What They Want */}
          {(result.tactics_detected?.length > 0 || result.what_they_want) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {result.tactics_detected?.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/50 p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tactics Used</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tactics_detected.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.what_they_want && (
                <div className="bg-card rounded-2xl border border-border/50 p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">What They Want</h4>
                  <p className="text-sm text-foreground/90">{result.what_they_want}</p>
                </div>
              )}
            </div>
          )}

          {/* What to Say */}
          {result.what_to_say && (
            <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-primary">What to Say</h4>
              </div>
              <p className="text-sm text-foreground/90 italic">"{result.what_to_say}"</p>
            </div>
          )}

          {/* False Positive Feedback + Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {result.risk_level !== "low" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFalsePositive}
                disabled={markedFP}
                className="text-muted-foreground gap-2"
              >
                {markedFP ? (
                  <>✓ Thanks for the feedback</>
                ) : (
                  <>
                    <ThumbsDown className="w-4 h-4" /> This was legitimate
                  </>
                )}
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Link to="/trust-history">
                <Button variant="outline" size="sm">View History</Button>
              </Link>
              <Button onClick={handleReset} size="sm" className="gap-2 bg-gradient-to-r from-primary to-primary/80">
                <RotateCcw className="w-3.5 h-3.5" /> Scan Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}