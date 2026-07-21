import React, { useState, useEffect } from "react";
import { Radar, MapPin, Loader2, Search, History, Clock, AlertTriangle, ChevronRight, Crosshair } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScanResultView from "@/components/scam/ScanResultView";
import LongLoadingScreen from "@/components/LongLoadingScreen";
import CommunityIntel from "@/components/community/CommunityIntel";

export default function LocalScamIntel() {
  const [locationInput, setLocationInput] = useState("");
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [error, setError] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await base44.entities.LocalScamScan.list("-created_date", 20);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const ipGeolocate = async () => {
    setGeoLoading(true);
    setError(null);
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data && data.city) {
        const name = [data.city, data.country_name].filter(Boolean).join(", ");
        setLocationInput(name);
        if (data.latitude && data.longitude) {
          setGeoCoords({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch {}
    setGeoLoading(false);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation || (typeof window !== "undefined" && !window.isSecureContext)) {
      ipGeolocate();
      return;
    }
    setGeoLoading(true);
    setError(null);

    let resolved = false;
    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ipGeolocate();
      }
    }, 16000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackTimer);
        const { latitude, longitude } = pos.coords;
        setGeoCoords({ latitude, longitude });
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          const name = [data.city || data.locality || data.principalSubdivision, data.countryName]
            .filter(Boolean)
            .join(", ");
          setLocationInput(name || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        } catch {
          setLocationInput(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        }
        setGeoLoading(false);
      },
      () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackTimer);
        ipGeolocate();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleScan = async () => {
    if (!locationInput.trim()) return;
    setScanning(true);
    setError(null);
    setCurrentResult(null);
    setSelectedScanId(null);
    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("scanLocalScams", {
        location_name: locationInput.trim(),
        latitude: geoCoords?.latitude,
        longitude: geoCoords?.longitude,
        language: lang,
      });
      if (response.data?.error) throw new Error(response.data.error);
      const analysis = response.data?.analysis;
      const scan = response.data?.scan;
      setCurrentResult({
        location_name: locationInput.trim(),
        risk_level: analysis.risk_level,
        summary: analysis.summary,
        common_scams: analysis.common_scams || [],
        seasonal_patterns: analysis.seasonal_patterns || [],
        local_resources: analysis.local_resources || [],
        current_trends: analysis.current_trends || "",
        sources: analysis.sources || [],
        created_date: scan?.created_date || new Date().toISOString(),
      });
      loadHistory();
    } catch (e) {
      setError(e.message || "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleSelectHistory = (scan) => {
    setSelectedScanId(scan.id);
    let commonScams = [];
    try {
      commonScams = JSON.parse(scan.scam_details || "[]");
    } catch {}
    setCurrentResult({
      location_name: scan.location_name,
      risk_level: scan.risk_level,
      summary: scan.summary,
      common_scams: commonScams,
      seasonal_patterns: scan.seasonal_patterns || [],
      local_resources: scan.local_resources || [],
      current_trends: scan.current_trends || "",
      sources: scan.sources || [],
      created_date: scan.created_date,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
            <Radar className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Local Scam Intelligence</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Discover what scams are common in your area and when they peak throughout the year. Powered by AI with live web data.
        </p>
      </div>

      {/* Location input */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={locationInput}
              onChange={(e) => {
                setLocationInput(e.target.value);
                setGeoCoords(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="Enter your city, e.g. Tel Aviv, Israel"
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleGeolocate} disabled={geoLoading} className="gap-2">
            {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            <span className="hidden sm:inline">My location</span>
          </Button>
          <Button onClick={handleScan} disabled={scanning || !locationInput.trim()} className="gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Scan
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Scanning state */}
      {scanning && <LongLoadingScreen type="local" />}

      {/* Result */}
      {!scanning && currentResult && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 animate-slide-up">
          <ScanResultView data={currentResult} />
          <div className="border-t border-border/50 pt-4 mt-4">
            <CommunityIntel country={currentResult.country} title="Local Community Stories" />
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Past Scans</h2>
        </div>
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No past scans yet. Run your first scan above.</p>
        ) : (
          <div className="space-y-2">
            {history.map((scan) => {
              const isSelected = scan.id === selectedScanId;
              const riskColor =
                scan.risk_level === "high"
                  ? "text-destructive bg-destructive/10"
                  : scan.risk_level === "medium"
                  ? "text-warning bg-warning/10"
                  : "text-success bg-success/10";
              return (
                <button
                  key={scan.id}
                  onClick={() => handleSelectHistory(scan)}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all text-left ${
                    isSelected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{scan.location_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(scan.created_date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${riskColor}`}>
                      {scan.risk_level}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}