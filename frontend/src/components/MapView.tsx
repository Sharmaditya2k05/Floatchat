import L from "leaflet";
import { useEffect, useRef, useState } from "react";

const isPfz = (f: GeoJSON.Feature) => {
  const p = f.properties ?? {};
  return Array.isArray(p.fish_species) || p.zone_name != null;
};
const FLOAT_C = "#35e0c0";
const PFZ_C = "#f5b544";

export default function MapView({
  geojson,
  legend,
}: {
  geojson: GeoJSON.FeatureCollection;
  legend?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { attributionControl: false, zoomControl: true }).setView([2, 75], 4);

    // Satellite imagery + a place-labels overlay — both keyless (Esri).
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 17 }
    ).addTo(map);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 17, opacity: 0.9 }
    ).addTo(map);

    // Lat/lon graticule with degree labels, redrawn as the view changes.
    const grat = L.layerGroup().addTo(map);
    const latLbl = (v: number) => (v === 0 ? "0°" : v > 0 ? `${v}°N` : `${-v}°S`);
    const lonLbl = (v: number) => (v === 0 ? "0°" : v > 0 ? `${v}°E` : `${-v}°W`);
    const drawGrat = () => {
      grat.clearLayers();
      const b = map.getBounds();
      const step = 10;
      const s = Math.floor(b.getSouth() / step) * step, n = Math.ceil(b.getNorth() / step) * step;
      const w = Math.floor(b.getWest() / step) * step, e = Math.ceil(b.getEast() / step) * step;
      const line = (pts: [number, number][]) =>
        L.polyline(pts, { color: "#a7bad0", weight: 0.5, opacity: 0.22, dashArray: "2 6", interactive: false }).addTo(grat);
      const label = (lat: number, lon: number, text: string, anchor: [number, number]) =>
        L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: "fc-grat", html: `<span>${text}</span>`, iconSize: [44, 14], iconAnchor: anchor }) }).addTo(grat);
      for (let lat = s; lat <= n; lat += step) {
        line([[lat, b.getWest()], [lat, b.getEast()]]);
        label(lat, b.getWest(), latLbl(lat), [-6, 7]);
      }
      for (let lon = w; lon <= e; lon += step) {
        line([[b.getSouth(), lon], [b.getNorth(), lon]]);
        label(b.getSouth(), lon, lonLbl(lon), [22, 18]);
      }
    };
    map.on("moveend zoomend", drawGrat);
    drawGrat();

    // Equator line — brighter, drawn on top of the graticule.
    L.polyline([[0, -20], [0, 160]], { color: "#e2e8f0", weight: 1, dashArray: "5 6", opacity: 0.6, interactive: false }).addTo(map);

    L.control.attribution({ prefix: false, position: "bottomleft" }).addAttribution("Imagery © Esri").addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.geoJSON(geojson, {
      pointToLayer: (f, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: "#0a1a12",
          fillColor: isPfz(f) ? PFZ_C : FLOAT_C,
          fillOpacity: 0.95,
          weight: 2,
        }),
      onEachFeature: (feature, l) => {
        const p = feature.properties ?? {};
        const pfz = isPfz(feature);
        const base = pfz ? PFZ_C : FLOAT_C;
        const when = p.profile_time
          ? new Date(p.profile_time).toISOString().slice(0, 10)
          : String(p.obs_date ?? p.issued_date ?? "").slice(0, 10);
        const title = p.wmo_id != null ? `Float ${p.wmo_id}` : pfz ? `PFZ · ${p.zone_name ?? "advisory"}` : "Observation";
        const lines: string[] = [when];
        if (p.sst_c != null) lines.push(`SST ${Number(p.sst_c).toFixed(1)} °C`);
        if (p.sst_anomaly_c != null) lines.push(`anomaly ${Number(p.sst_anomaly_c).toFixed(1)} °C`);
        if (p.chl_a_mg_m3 != null) lines.push(`chl-a ${Number(p.chl_a_mg_m3).toFixed(2)} mg/m³`);
        if (p.chlorophyll_mg != null) lines.push(`chl ${Number(p.chlorophyll_mg).toFixed(2)} mg/m³`);
        if (Array.isArray(p.fish_species) && p.fish_species.length) lines.push(p.fish_species.join(", "));
        if (p.confidence) lines.push(`confidence: ${p.confidence}`);
        if (pfz && p.valid_to) lines.push(`valid to ${String(p.valid_to).slice(0, 10)}`);
        l.bindPopup(
          `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.5">
             <b style="color:${base}">${title}</b><br/>${lines.filter(Boolean).join("<br/>")}
           </div>`
        );
        l.on("mouseover", () => (l as L.CircleMarker).setStyle({ radius: 8, fillColor: pfz ? "#ffd27a" : PFZ_C }));
        l.on("mouseout", () => (l as L.CircleMarker).setStyle({ radius: 6, fillColor: base }));
      },
    }).addTo(map);
    layerRef.current = layer;
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.35), { maxZoom: 6 });
  }, [geojson]);

  useEffect(() => {
    // Re-measure after a fullscreen toggle so tiles fill the new size.
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 60);
    return () => clearTimeout(id);
  }, [fs]);

  if (!geojson.features.length) {
    return (
      <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--ink-faint)" }}>
        No positions to map for this query.
      </div>
    );
  }
  const anyPfz = geojson.features.some(isPfz);

  return (
    <div
      ref={divRef}
      className={fs ? "fixed inset-3 z-50" : "relative h-full w-full"}
      style={fs ? { borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px -12px rgba(0,0,0,.7)" } : undefined}
    >
      <button
        onClick={() => setFs((v) => !v)}
        title={fs ? "Exit full screen" : "Full screen"}
        className="absolute right-3 top-3 z-[1000] grid h-8 w-8 place-items-center rounded-lg"
        style={{ background: "rgba(14,24,38,.85)", border: "1px solid var(--border)", color: "var(--ink-dim)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {fs ? <path d="M9 3H5a2 2 0 0 0-2 2v4m18 0V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m10 0h4a2 2 0 0 0 2-2v-4" />
              : <path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3" />}
        </svg>
      </button>
      {legend && (
        <div
          className="absolute bottom-3 right-3 z-[1000] rounded-xl px-3 py-2"
          style={{ background: "rgba(14,24,38,.9)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="fc-dot" style={{ width: 8, height: 8, borderRadius: 999, background: anyPfz ? "var(--amber)" : "var(--seafoam)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{anyPfz ? "Fishing zones" : "Float locations"}</span>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>{legend}</p>
        </div>
      )}
    </div>
  );
}
