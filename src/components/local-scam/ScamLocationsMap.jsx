import React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const RISK_COLORS = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#dc2626",
};

function riskRadius(level) {
  return level === "high" ? 14 : level === "medium" ? 10 : 7;
}

export default function ScamLocationsMap({ scans }) {
  const locations = scans.filter(
    (s) => s.latitude != null && s.longitude != null && !isNaN(s.latitude) && !isNaN(s.longitude)
  );

  if (locations.length === 0) {
    return (
      <div className="p-5 rounded-2xl border border-border/50 bg-card">
        <h3 className="font-semibold text-sm mb-4">Most Active Scam Locations</h3>
        <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
          No geolocated scans yet. Scans with location data will appear on the map.
        </div>
      </div>
    );
  }

  const avgLat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
  const avgLng = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;
  const zoom = locations.length === 1 ? 6 : 2;

  return (
    <div className="p-5 rounded-2xl border border-border/50 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Most Active Scam Locations</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS.high }} />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS.medium }} />
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS.low }} />
            Low
          </span>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-border/50" style={{ height: 360 }}>
        <MapContainer
          center={[avgLat, avgLng]}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {locations.map((loc, i) => {
            const color = RISK_COLORS[loc.risk_level] || RISK_COLORS.low;
            return (
              <CircleMarker
                key={i}
                center={[loc.latitude, loc.longitude]}
                radius={riskRadius(loc.risk_level)}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 2 }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{loc.location_name}</p>
                    <p className="text-xs capitalize">Risk: {loc.risk_level || "unknown"}</p>
                    {loc.summary && (
                      <p className="text-xs max-w-[220px]">{loc.summary.slice(0, 120)}</p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}