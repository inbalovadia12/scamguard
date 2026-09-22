import React, { useState, useEffect } from "react";
import { MapPin, Search, Loader2, LocateFixed, ShieldCheck, AlertTriangle, ShieldAlert, Calendar, Phone, TrendingUp, ExternalLink, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlanGate from "@/components/PlanGate";
import { getCreditStatus } from "@/lib/credits";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import AIDisclaimer from "@/components/AIDisclaimer";

const RISK_CONFIG = {
  low: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck, label: "Low Risk Area" },
  medium: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, label: "Be Cautious" },
  high: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, label: "High Risk Area" },
};

const COST = 5;

export default function LocalScamFinder() {
  const [locationInput, setLocationInput] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        const status = await getCreditStatus();
        setCredits(status);
        if (status.isPaid) loadHistory();
      } catch {} finally { setCheckingPlan(false); }
    };
    init();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await base44.entities.LocalScamScan.list("-created_date", 10);
      setHistory(data);
    } catch {}
  };

  const handleLocate = () => {
    setLocating(true); setError(null);
    if (!navigator.geolocation) { fallbackIpLocate(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationInput("");
        setLocating(false);
      },
      () => {
        // Browser geolocation blocked/unavailable (common in embedded preview
        // iframes without geolocation permission). Fall back to IP-based
        // geolocation for an approximate location.
        fallbackIpLocate();
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  };

  const fallbackIpLocate = async () => {
    setLocating(true);
    try {
      const res = await fetch("https://ipwho.is/");
      const data = await res.json();
      if (data && data.success !== false && data.latitude != null) {
        const name = [data.city, data.region, data.country].filter(Boolean).join(", ");
        setLocationInput(name || data.country || "");
        setCoords({ latitude: data.latitude, longitude: data.longitude });
        setLocating(false);
        return;
      }
      throw new Error(data?.message || "failed");
    } catch (e) {
      setLocating(false);
      setError("Couldn't detect your location automatically. Please enter your city manually.");
      setCoords(null);
    }
  };

  const handleScan = async () => {
    if (!locationInput.trim() && !coords) return;
    setScanning(true); setError(null); setResult(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const payload = { language: lang };
      if (locationInput.trim()) payload.location = locationInput.trim();
      else { payload.latitude = coords.latitude; payload.longitude = coords.longitude; }
      const response = await base44.functions.invoke("scanLocalScams", payload);
      if (response.data?.error) throw new Error(response.data.error);
      setResult(response.data?.result);
      if (response.data?.credits_remaining != null) {
        setCredits((prev) => prev ? { ...prev, remaining: response.data.credits_remaining, limit: response.data.credits_limit } : prev);
      }
      loadHistory();
    } catch (e) {
      setError(e.message || "Local scam scan failed. Please try again.");
    } finally { setScanning(false); }
  };

  const handleRescan = () => { setResult(null); setLocationInput(""); setCoords(null); setError(null); };

  const showHistoryItem = (h) => {
    let details = [];
    try { details = JSON.parse(h.scam_details || "[]"); } catch { details = []; }
    setResult({
      location_name: h.location_name, country: h.country, latitude: h.latitude, longitude: h.longitude,
      risk_level: h.risk_level, summary: h.summary, scam_details: details,
      seasonal_patterns: h.seasonal_patterns || [], local_resources: h.local_resources || [],
      current_trends: h.current_trends || "", sources: h.sources || [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (checkingPlan) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!credits?.isPaid) {
    return <PlanGate icon={MapPin} title="Local Scam Finder" description="See what scams are trending in your area — common local scams, seasonal patterns, and where to report them." plan="Plus" />;
  }

  const cfg = result ? (RISK_CONFIG[result.risk_level] || RISK_CONFIG.low) : null;
  const RiskIcon = cfg?.icon;
  const hasMap = result?.latitude != null && result?.longitude != null && Number.isFinite(result.latitude) && Number.isFinite(result.longitude);
  const mapSrc = hasMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${result.longitude - 0.08}%2C${result.latitude - 0.08}%2C${result.longitude + 0.08}%2C${result.latitude + 0.08}&layer=mapnik&marker=${result.latitude}%2C${result.longitude}`
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2 animate-slide-up">
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Local Scam Finder</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto hidden sm:block">
          Discover the scams targeting your city or region — common tricks, seasonal peaks, and local reporting resources.
        </p>
      </div>

      {!scanning && !result && (
        <div className="space-y-5 animate-slide-up anim-delay-1">
          <AIDisclaimer />
          {credits && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted rounded-xl">
              <span className="text-sm text-muted-foreground">✦ {credits.plan === "premium" ? "Premium" : "Plus"} plan</span>
              <span className="text-sm font-medium">{credits.remaining} credits left{credits.adminCreditBalance > 0 ? ` · ${credits.adminCreditBalance} bonus` : ""}</span>
            </div>
          )}
          <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your location</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={locationInput} onChange={(e) => { setLocationInput(e.target.value); setCoords(null); }} placeholder="Enter a city, region, or country…" className="h-11 text-base rounded-xl" onKeyDown={(e) => e.key === "Enter" && handleScan()} />
                <Button variant="outline" onClick={handleLocate} disabled={locating} className="gap-2 h-11 rounded-xl flex-shrink-0">
                  {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                  {locating ? "Locating…" : "Use my location"}
                </Button>
              </div>
              {coords && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Detected: {coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)}</p>}
            </div>
            <Button onClick={handleScan} disabled={scanning || (!locationInput.trim() && !coords)} className="w-full h-11 sm:h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 gap-2">
              {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Analyze Area · {COST} credits
            </Button>
          </div>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        </div>
      )}

      {scanning && (
        <div className="rounded-3xl border border-border/50 bg-card p-6 sm:p-8 animate-fade-in">
          <LongLoadingScreen type="local" />
        </div>
      )}

      {!scanning && result && cfg && RiskIcon && (
        <div className="space-y-5 animate-slide-up">
          <div className={`rounded-3xl border-2 ${cfg.border} ${cfg.bg} p-5 sm:p-6`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl ${cfg.bg} flex items-center justify-center`}><RiskIcon className={`w-6 h-6 ${cfg.color}`} /></div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Scam Risk for</p>
                <h2 className={`text-xl font-bold font-heading ${cfg.color} truncate`}>{result.location_name || "This Area"}</h2>
              </div>
              <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${cfg.bg} ${cfg.color} flex-shrink-0`}>{cfg.label}</span>
            </div>
            <p className="text-sm text-foreground/80 mt-4 leading-relaxed">{result.summary}</p>
          </div>

          {mapSrc && (
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden">
              <iframe title="Area map" src={mapSrc} style={{ height: "260px", width: "100%", border: 0 }} loading="lazy" />
            </div>
          )}

          {result.scam_details?.length > 0 && (
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Common Scams Here</h3>
              <div className="space-y-2.5">
                {result.scam_details.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-border/50 bg-muted/30 p-3.5">
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                    {(s.peak_season || s.peak_months) && <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Peaks: {s.peak_season || s.peak_months}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.seasonal_patterns?.length > 0 && (
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Seasonal Patterns</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
                {result.seasonal_patterns.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {result.current_trends && (
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Current Trends</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.current_trends}</p>
            </div>
          )}

          {result.local_resources?.length > 0 && (
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Local Reporting Resources</h3>
              <ul className="space-y-1.5">
                {result.local_resources.map((r, i) => {
                  const isUrl = /^https?:\/\//i.test(r);
                  return <li key={i} className="text-sm">{isUrl ? <a href={r} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 break-all">{r}<ExternalLink className="w-3 h-3 flex-shrink-0" /></a> : <span className="text-muted-foreground">{r}</span>}</li>;
                })}
              </ul>
            </div>
          )}

          {result.sources?.length > 0 && (
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold">Sources</h3>
              <ul className="space-y-1.5">
                {result.sources.map((s, i) => <li key={i}><a href={s} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">{s}<ExternalLink className="w-3 h-3 flex-shrink-0" /></a></li>)}
              </ul>
            </div>
          )}

          <div className="flex justify-center"><Button variant="outline" onClick={handleRescan} className="rounded-xl">Scan another area</Button></div>
        </div>
      )}

      {!scanning && (
        <div className="space-y-3 animate-slide-up">
          <div className="flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Past Area Scans</h2></div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No area scans yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const rc = RISK_CONFIG[h.risk_level] || RISK_CONFIG.low;
                return (
                  <button key={h.id} onClick={() => showHistoryItem(h)} className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 text-left">
                    <div className="flex items-center gap-3 min-w-0"><MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{h.location_name}</p>{h.country && <p className="text-xs text-muted-foreground truncate">{h.country}</p>}</div></div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rc.bg} ${rc.color} flex-shrink-0`}>{rc.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}