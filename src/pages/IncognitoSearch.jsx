import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  EyeOff, Loader2, AlertTriangle, ShieldCheck, ShieldX, MessageSquare, Globe,
  Image as ImageIcon, Phone, MessagesSquare, Sparkles, Upload, X, Crown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCreditStatus } from "@/lib/credits";
import PhoneResultView from "@/components/scam/PhoneResultView";
import AIDisclaimer from "@/components/AIDisclaimer";

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", label: "Low Risk" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", label: "Medium Risk" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", label: "High Risk" },
};

export default function IncognitoSearch() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isChild, setIsChild] = useState(false);
  const [activeTab, setActiveTab] = useState("message");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [messageText, setMessageText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [conversationText, setConversationText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await base44.auth.me();
        const status = await getCreditStatus();
        const seniors = await base44.entities.ProtectedSenior.filter({ senior_user_id: user.id });
        if (seniors.length > 0) {
          setIsChild(true);
          setAllowed(seniors[0].incognito_allowed === true);
        } else {
          setAllowed(status.isPremiumPlan);
        }
      } catch {
        setAllowed(false);
      }
      setChecking(false);
    };
    init();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image must be under 10MB."); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getRiskData = (data, type) => {
    if (type === "phone") return { level: data.risk_level, score: data.reputation_score };
    if (type === "conversation") return { level: data.overall_risk, score: data.risk_score };
    return { level: data.risk_level, score: data.risk_score };
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const langName = { en: "English", he: "Hebrew", es: "Spanish" }[lang] || "English";

      if (activeTab === "message") {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are Vardin, an AI scam detection assistant. Analyze this suspicious message for scam risk.\n\nMessage: "${messageText.trim()}"\n\nAnalyze for: urgency, money requests, personal info harvesting, impersonation, too good to be true, phishing links.\n\nProvide: risk_level (low/medium/high), risk_score (0-100), explanation (2-3 sentences), tactics_detected (array), next_steps (array), what_they_want (string).\n\nRespond in ${langName}.`,
          response_json_schema: {
            type: "object",
            properties: {
              risk_level: { type: "string", enum: ["low", "medium", "high"] },
              risk_score: { type: "number" },
              explanation: { type: "string" },
              tactics_detected: { type: "array", items: { type: "string" } },
              next_steps: { type: "array", items: { type: "string" } },
              what_they_want: { type: "string" },
            },
          },
        });
        setResult({ type: "message", data: res });
      } else if (activeTab === "url") {
        const response = await base44.functions.invoke("scanUrl", { url: urlInput.trim() });
        if (response.data?.error) throw new Error(response.data.error);
        setResult({ type: "url", data: response.data });
      } else if (activeTab === "phone") {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a phone number reputation analyst. Research the phone number: ${phoneInput.trim()}\n\nCheck scam call databases, robocall reports, spam reports. Provide: country, carrier, reputation_score (0-100, 0=safe), risk_level (low/medium/high), user_reports (array of verified reports), scam_categories (array), summary (honest assessment), sources (array of URLs specifically about this number). If no reports found, set low risk and empty arrays.\n\nRespond in ${langName}.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              country: { type: "string" },
              carrier: { type: "string" },
              reputation_score: { type: "number" },
              risk_level: { type: "string", enum: ["low", "medium", "high"] },
              user_reports: { type: "array", items: { type: "string" } },
              scam_categories: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
              sources: { type: "array", items: { type: "string" } },
            },
          },
        });
        setResult({ type: "phone", data: { ...res, phone_number: phoneInput.trim() } });
      } else if (activeTab === "image") {
        let image_url = null;
        if (selectedFile) {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
          image_url = uploadRes.file_url;
        }
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a reverse image scam detection analyst. Analyze the uploaded photo for scam indicators.\n\nCheck if this appears elsewhere online (stock photos, social media, scam reports). Identify red flags: stock photo indicators, AI generation, photos on multiple profiles.\n\nProvide: risk_level, risk_score (0-100), is_likely_scam_profile (boolean), explanation, similar_images_found (array), sources (array), red_flags (array).\n\nRespond in ${langName}.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          file_urls: [image_url],
          response_json_schema: {
            type: "object",
            properties: {
              risk_level: { type: "string", enum: ["low", "medium", "high"] },
              risk_score: { type: "number" },
              is_likely_scam_profile: { type: "boolean" },
              explanation: { type: "string" },
              similar_images_found: { type: "array", items: { type: "string" } },
              sources: { type: "array", items: { type: "string" } },
              red_flags: { type: "array", items: { type: "string" } },
            },
          },
        });
        setResult({ type: "image", data: res });
      } else if (activeTab === "conversation") {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are Vardin, an AI scam detection assistant. Analyze this entire chat conversation for scam patterns over time.\n\nConversation:\n"""${conversationText.trim().slice(0, 10000)}"""\n\nLook for: escalation, grooming, repeated requests, inconsistencies, information harvesting, isolation tactics.\n\nProvide: is_likely_scam (boolean), overall_risk (low/medium/high), risk_score (0-100), patterns_detected (array), red_flag_messages (array of strings with explanations), escalation_summary (string), what_they_want (string), recommended_actions (array), summary (string).\n\nRespond in ${langName}.`,
          response_json_schema: {
            type: "object",
            properties: {
              is_likely_scam: { type: "boolean" },
              overall_risk: { type: "string", enum: ["low", "medium", "high"] },
              risk_score: { type: "number" },
              patterns_detected: { type: "array", items: { type: "string" } },
              red_flag_messages: { type: "array", items: { type: "string" } },
              escalation_summary: { type: "string" },
              what_they_want: { type: "string" },
              recommended_actions: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
            },
          },
        });
        setResult({ type: "conversation", data: res });
      }
    } catch (e) {
      setError(e.message || "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const canScan = () => {
    if (scanning) return false;
    if (activeTab === "message") return messageText.trim().length > 10;
    if (activeTab === "url") return urlInput.trim().length > 3;
    if (activeTab === "phone") return phoneInput.trim().length > 3;
    if (activeTab === "image") return !!selectedFile;
    if (activeTab === "conversation") return conversationText.trim().length > 20;
    return false;
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border/50 p-8 text-center space-y-4 animate-slide-up flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isChild ? <ShieldX className="w-8 h-8 text-primary" /> : <Crown className="w-8 h-8 text-primary" />}
          </div>
          <h1 className="text-xl font-bold font-heading">Incognito Search</h1>
          {isChild ? (
            <>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your guardian hasn't enabled Incognito Search for you yet. Ask them to enable it in Family settings.
              </p>
              <Button asChild className="w-full max-w-xs">
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Scan anything privately — no history saved, no guardian alerts. Available on Premium.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Crown className="w-4 h-4" /> Premium Feature
              </div>
              <Button asChild className="w-full max-w-xs">
                <Link to="/pricing">Upgrade to Premium</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const riskData = result ? getRiskData(result.data, result.type) : null;
  const riskCfg = riskData ? RISK_CONFIG[riskData.level] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <EyeOff className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">Incognito Search</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          All scan types, same AI engines — nothing saved, no guardian alerts, no history.
        </p>
      </div>

      {/* Privacy Banner */}
      <div className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-primary/5 border border-primary/20 animate-slide-up" style={{ animationDelay: "30ms" }}>
        <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="text-sm min-w-0">
          <p className="font-medium text-primary">Private mode active</p>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">Results stay on your screen only. Nothing is stored or shared with your guardian.</p>
        </div>
      </div>

      {/* Scan Type Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up" style={{ animationDelay: "50ms" }}>
        <TabsList className="grid grid-cols-5 w-full bg-card border border-border/50">
          <TabsTrigger value="message" className="gap-1 text-xs sm:text-sm"><MessageSquare className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Message</span></TabsTrigger>
          <TabsTrigger value="url" className="gap-1 text-xs sm:text-sm"><Globe className="w-3.5 h-3.5" /> <span className="hidden sm:inline">URL</span></TabsTrigger>
          <TabsTrigger value="image" className="gap-1 text-xs sm:text-sm"><ImageIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Image</span></TabsTrigger>
          <TabsTrigger value="phone" className="gap-1 text-xs sm:text-sm"><Phone className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Phone</span></TabsTrigger>
          <TabsTrigger value="conversation" className="gap-1 text-xs sm:text-sm"><MessagesSquare className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Chat</span></TabsTrigger>
        </TabsList>

        <TabsContent value="message" className="mt-4">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Paste the suspicious message..."
            className="min-h-[140px] resize-y text-sm leading-relaxed"
            disabled={scanning}
          />
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canScan() && handleScan()}
            placeholder="https://suspicious-site.com"
            className="h-12 text-base"
            disabled={scanning}
          />
        </TabsContent>

        <TabsContent value="image" className="mt-4 space-y-3">
          {previewUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-border/50">
              <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain bg-muted/30" />
              <button onClick={clearImage} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-border/50 p-8 text-center hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Upload an image</p>
              <p className="text-xs text-muted-foreground mt-1">Profile photo, screenshot, or listing image</p>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </TabsContent>

        <TabsContent value="phone" className="mt-4">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canScan() && handleScan()}
              placeholder="Enter phone number..."
              className="pl-9 h-12 text-base"
              disabled={scanning}
            />
          </div>
        </TabsContent>

        <TabsContent value="conversation" className="mt-4">
          <Textarea
            value={conversationText}
            onChange={(e) => setConversationText(e.target.value)}
            placeholder="Paste the full conversation..."
            className="min-h-[160px] resize-y text-sm leading-relaxed"
            disabled={scanning}
          />
        </TabsContent>
      </Tabs>

      {/* Scan Button */}
      <Button
        onClick={handleScan}
        disabled={!canScan()}
        className="w-full gap-2 h-11 bg-gradient-to-r from-primary to-primary/80"
      >
        {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {scanning ? "Scanning privately..." : "Scan Incognito"}
      </Button>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <AIDisclaimer />

      {/* Results */}
      {result && !scanning && riskCfg && (
        <div className="space-y-4 animate-slide-up">
          {/* Risk Badge */}
          <div className={`rounded-2xl border-2 ${riskCfg.border} ${riskCfg.bg} p-4 sm:p-5`}>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className={`w-6 h-6 ${riskCfg.color}`} />
              <div>
                <p className={`text-lg font-bold ${riskCfg.color}`}>{riskCfg.label}</p>
                {riskData.score != null && <p className="text-xs text-muted-foreground text-center">Score: {riskData.score}/100</p>}
              </div>
            </div>
          </div>

          {/* Type-specific results */}
          {result.type === "phone" ? (
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <PhoneResultView data={result.data} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Explanation/Summary */}
              {(result.data.explanation || result.data.summary) && (
                <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-2">Assessment</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.data.explanation || result.data.summary}</p>
                </div>
              )}

              {/* Patterns/Tactics */}
              {(result.data.tactics_detected || result.data.patterns_detected)?.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-3">{result.type === "conversation" ? "Patterns Detected" : "Tactics Detected"}</h3>
                  <div className="space-y-2">
                    {(result.data.tactics_detected || result.data.patterns_detected).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                        <span className="text-foreground/90 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {(result.data.red_flags || result.data.red_flag_messages)?.length > 0 && (
                <div className="bg-card rounded-2xl border border-warning/20 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-3">Red Flags</h3>
                  <div className="space-y-2">
                    {(result.data.red_flags || result.data.red_flag_messages).map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-warning font-bold flex-shrink-0">⚠</span>
                        <span className="text-foreground/90 leading-relaxed">{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What they want */}
              {result.data.what_they_want && result.data.what_they_want !== "N/A" && (
                <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-2">What They're After</h3>
                  <p className="text-sm text-foreground/90 leading-relaxed">{result.data.what_they_want}</p>
                </div>
              )}

              {/* Next Steps / Recommended Actions */}
              {(result.data.next_steps || result.data.recommended_actions)?.length > 0 && (
                <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-3">{result.type === "conversation" ? "Recommended Actions" : "Next Steps"}</h3>
                  <div className="space-y-2">
                    {(result.data.next_steps || result.data.recommended_actions).map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                        <span className="text-foreground/90 leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Escalation Summary */}
              {result.data.escalation_summary && (
                <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-2">How It Escalated</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.data.escalation_summary}</p>
                </div>
              )}

              {/* Sources */}
              {result.data.sources?.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-2">Sources</h3>
                  <div className="space-y-1">
                    {result.data.sources.slice(0, 5).map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block truncate">
                        {src}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <EyeOff className="w-3 h-3" />
            This result was not saved and no alerts were sent.
          </p>
        </div>
      )}
    </div>
  );
}