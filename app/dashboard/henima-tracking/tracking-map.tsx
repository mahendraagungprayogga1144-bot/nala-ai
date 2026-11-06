"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { mapsUrl, type TrackingPoint } from "@/lib/henima-tracking/shared";

const COLORS = ["#2563EB", "#3B82F6", "#1D4ED8", "#0EA5E9", "#6366F1"];
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type GMaps = typeof google.maps;

declare global {
  interface Window {
    google?: typeof google;
    __henimaGoogleMapsReady?: () => void;
  }
}

function loadGoogleMaps(key: string): Promise<GMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-henima-google-maps]");
    if (existing) {
      const wait = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(wait);
          resolve(window.google.maps);
        }
      }, 80);
      window.setTimeout(() => {
        window.clearInterval(wait);
        reject(new Error("Timeout Google Maps"));
      }, 15000);
      return;
    }
    window.__henimaGoogleMapsReady = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps gagal init"));
    };
    const script = document.createElement("script");
    script.dataset.henimaGoogleMaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__henimaGoogleMapsReady&v=weekly`;
    script.onerror = () => reject(new Error("Gagal memuat Google Maps script"));
    document.head.appendChild(script);
  });
}

function groupPoints(points: TrackingPoint[], focusStaffId?: string) {
  const byStaff = new Map<string, TrackingPoint[]>();
  for (const point of points) {
    if (focusStaffId && point.staff_id !== focusStaffId) continue;
    const list = byStaff.get(point.staff_id) || [];
    list.push(point);
    byStaff.set(point.staff_id, list);
  }
  return byStaff;
}

/** Meter antar 2 titik (approx). */
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rapikan rute supaya enak dibaca:
 * GPS diam/indoor sering “goyang” → banyak garis ke segala arah.
 * 1) skip ping jelek / terlalu dekat
 * 2) buang spike bolak-balik
 */
function smoothRoute(ordered: TrackingPoint[]) {
  if (ordered.length <= 2) return ordered;

  const spaced: TrackingPoint[] = [ordered[0]];
  for (let i = 1; i < ordered.length - 1; i++) {
    const point = ordered[i];
    if (point.kind !== "ping") {
      spaced.push(point);
      continue;
    }
    // Titik akurasi jelek = sumber "banyak arah"
    if ((point.accuracy_m || 999) > 90) continue;
    const prev = spaced[spaced.length - 1];
    const dist = metersBetween(prev, point);
    const minMove = Math.max(70, Math.max(prev.accuracy_m || 45, point.accuracy_m || 45));
    if (dist < minMove) continue;
    spaced.push(point);
  }
  const last = ordered[ordered.length - 1];
  if (spaced[spaced.length - 1] !== last) spaced.push(last);
  if (spaced.length < 3) return spaced;

  const out: TrackingPoint[] = [spaced[0]];
  for (let i = 1; i < spaced.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = spaced[i];
    const next = spaced[i + 1];
    if (cur.kind !== "ping") {
      out.push(cur);
      continue;
    }
    const ab = metersBetween(prev, cur);
    const bc = metersBetween(cur, next);
    const ac = metersBetween(prev, next);
    // Spike: keluar lalu balik — bikin bintang di peta
    if (ac < 100 && ab + bc > ac * 1.6 && ab > 20 && bc > 20) continue;
    out.push(cur);
  }
  out.push(spaced[spaced.length - 1]);
  return out;
}

function trailPoints(ordered: TrackingPoint[], latest: TrackingPoint) {
  const cleaned = smoothRoute(ordered).filter((point) => point !== latest);
  const trail = cleaned.filter((point, index) => {
    if (point.kind !== "ping") return true;
    return index === 0 || index % 3 === 0;
  });
  return trail.length > 40 ? trail.filter((_, index) => index % Math.ceil(trail.length / 40) === 0) : trail;
}

export default function TrackingMap({
  points,
  colorOf,
  nameOf,
  focusStaffId,
  focusPointId,
  onPoint,
}: {
  points: TrackingPoint[];
  colorOf: (staffId: string) => string;
  nameOf: (staffId: string) => string;
  focusStaffId?: string;
  focusPointId?: string;
  onPoint?: (point: TrackingPoint) => void;
}) {
  if (GOOGLE_KEY) {
    return (
      <GoogleTrackingMap
        apiKey={GOOGLE_KEY}
        points={points}
        colorOf={colorOf}
        nameOf={nameOf}
        focusStaffId={focusStaffId}
        focusPointId={focusPointId}
        onPoint={onPoint}
      />
    );
  }
  return (
    <LeafletTrackingMap
      points={points}
      colorOf={colorOf}
      nameOf={nameOf}
      focusStaffId={focusStaffId}
      focusPointId={focusPointId}
      onPoint={onPoint}
    />
  );
}

function MapChrome({
  basemap,
  setBasemap,
  locateMe,
  locateNote,
  engine,
}: {
  basemap: "peta" | "satelit";
  setBasemap: (v: "peta" | "satelit") => void;
  locateMe: () => void;
  locateNote: string;
  engine: string;
}) {
  return (
    <>
      <div className="absolute right-3 top-3 z-[400] flex overflow-hidden rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold shadow-sm">
        <button type="button" onClick={() => setBasemap("peta")} className={`px-3 py-1.5 ${basemap === "peta" ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>
          Peta
        </button>
        <button type="button" onClick={() => setBasemap("satelit")} className={`px-3 py-1.5 ${basemap === "satelit" ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>
          Satelit
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-2 text-[11px] font-medium text-[#64748B] shadow-sm">
        <p className="mb-1 font-semibold text-[#0F172A]">Keterangan · {engine}</p>
        <p>
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#1E3A8A]" />
          Posisi terakhir
        </p>
        <p className="mt-1">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#60A5FA]" />
          Titik rute
        </p>
        <p className="mt-1">Garis biru = rute</p>
      </div>
      <button
        type="button"
        onClick={locateMe}
        className="absolute bottom-3 right-3 z-[400] rounded-full border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] shadow-sm"
      >
        Lokasi saya
      </button>
      {locateNote && (
        <p className="absolute bottom-14 right-3 z-[400] rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] text-[#B45309] shadow-sm">{locateNote}</p>
      )}
    </>
  );
}

function GoogleTrackingMap({
  apiKey,
  points,
  colorOf,
  nameOf,
  focusStaffId,
  focusPointId,
  onPoint,
}: {
  apiKey: string;
  points: TrackingPoint[];
  colorOf: (staffId: string) => string;
  nameOf: (staffId: string) => string;
  focusStaffId?: string;
  focusPointId?: string;
  onPoint?: (point: TrackingPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<{ setMap: (map: google.maps.Map | null) => void }>>([]);
  const onPointRef = useRef(onPoint);
  const [basemap, setBasemap] = useState<"peta" | "satelit">("satelit");
  const [locateNote, setLocateNote] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    onPointRef.current = onPoint;
  }, [onPoint]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !host.current) return;
        const map = new maps.Map(host.current, {
          center: { lat: -2.2, lng: 118 },
          zoom: 5,
          mapTypeId: "hybrid",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Gagal memuat Google Maps"));
    return () => {
      cancelled = true;
      overlaysRef.current.forEach((item) => item.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
      setReady(false);
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !window.google?.maps) return;
    map.setMapTypeId(basemap === "satelit" ? "hybrid" : "roadmap");
  }, [basemap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps || !ready) return;

    overlaysRef.current.forEach((item) => item.setMap(null));
    overlaysRef.current = [];

    const byStaff = groupPoints(points, focusStaffId);
    const bounds = new maps.LatLngBounds();
    let hasBounds = false;
    const latestPins: google.maps.LatLngLiteral[] = [];

    for (const [staffId, list] of byStaff) {
      const ordered = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const color = colorOf(staffId);
      const nama = nameOf(staffId);
      const route = smoothRoute(ordered);
      const path = route.map((point) => ({ lat: point.lat, lng: point.lng }));
      path.forEach((p) => {
        bounds.extend(p);
        hasBounds = true;
      });
      if (path.length > 1) {
        const poly = new maps.Polyline({
          path,
          map,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 4,
        });
        overlaysRef.current.push(poly);
      }

      const latest = ordered[ordered.length - 1];
      if (!latest) continue;
      latestPins.push({ lat: latest.lat, lng: latest.lng });

      const acc = Math.min(Math.max(latest.accuracy_m || 30, 18), 90);
      overlaysRef.current.push(
        new maps.Circle({
          map,
          center: { lat: latest.lat, lng: latest.lng },
          radius: acc,
          strokeColor: color,
          strokeOpacity: 0.25,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.08,
          clickable: false,
        }),
      );

      for (const point of trailPoints(ordered, latest)) {
        const important = point.kind !== "ping";
        const marker = new maps.Marker({
          map,
          position: { lat: point.lat, lng: point.lng },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: important ? 7 : 4,
            fillColor: important && (point.kind === "visit" || point.kind === "qris") ? "#60A5FA" : color,
            fillOpacity: important ? 0.95 : 0.7,
            strokeColor: "#FFFFFF",
            strokeWeight: important ? 2 : 1,
          },
        });
        if (important) marker.addListener("click", () => onPointRef.current?.(point));
        overlaysRef.current.push(marker);
      }

      const gmaps = mapsUrl(latest.lat, latest.lng);
      const info = new maps.InfoWindow({
        content: `<div style="min-width:150px;font:12px/1.4 system-ui,sans-serif">
          <strong>${escapeHtml(nama)}</strong><br/>Posisi terakhir<br/>
          <a href="${gmaps}" target="_blank" rel="noreferrer" style="color:#C5A358;font-weight:700">Buka di Google Maps</a>
        </div>`,
      });

      const lastMarker = new maps.Marker({
        map,
        position: { lat: latest.lat, lng: latest.lng },
        label: {
          text: initials(nama),
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: "11px",
        },
        title: nama,
        zIndex: 1000,
      });
      lastMarker.addListener("click", () => {
        info.open({ map, anchor: lastMarker });
        onPointRef.current?.(latest);
      });
      overlaysRef.current.push(lastMarker);
    }

    const picked = focusPointId ? points.find((point) => point.id === focusPointId) : undefined;
    if (picked) map.setOptions({ center: { lat: picked.lat, lng: picked.lng }, zoom: 17 });
    else if (latestPins.length === 1) map.setOptions({ center: latestPins[0], zoom: 16 });
    else if (hasBounds) map.fitBounds(bounds, 48);
    else map.setOptions({ center: { lat: -2.2, lng: 118 }, zoom: 5 });
  }, [points, colorOf, nameOf, focusStaffId, focusPointId, ready]);

  function locateMe() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) {
      setLocateNote("Lokasi perangkat tidak tersedia.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setOptions({ center: { lat: pos.coords.latitude, lng: pos.coords.longitude }, zoom: 16 });
        setLocateNote("");
      },
      () => setLocateNote("Izin lokasi ditolak."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return (
    <>
      <div ref={host} className="henima-track-map absolute inset-0" />
      {loadError && (
        <p className="absolute inset-x-3 top-14 z-[400] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {loadError}. Cek API key / billing Google Maps.
        </p>
      )}
      <MapChrome basemap={basemap} setBasemap={setBasemap} locateMe={locateMe} locateNote={locateNote} engine="Google Maps" />
    </>
  );
}

function LeafletTrackingMap({
  points,
  colorOf,
  nameOf,
  focusStaffId,
  focusPointId,
  onPoint,
}: {
  points: TrackingPoint[];
  colorOf: (staffId: string) => string;
  nameOf: (staffId: string) => string;
  focusStaffId?: string;
  focusPointId?: string;
  onPoint?: (point: TrackingPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tilesRef = useRef<import("leaflet").TileLayer | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const onPointRef = useRef(onPoint);
  const [basemap, setBasemap] = useState<"peta" | "satelit">("peta");
  const [locateNote, setLocateNote] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onPointRef.current = onPoint;
  }, [onPoint]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;

    void (async () => {
      const leaflet = await import("leaflet");
      const L = (leaflet as { default?: typeof import("leaflet") }).default ?? leaflet;
      if (cancelled || !host.current) return;
      LRef.current = L;
      const map = L.map(host.current, { zoomControl: true, attributionControl: false }).setView([-2.2, 118], 5);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      tilesRef.current = null;
      LRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY || "w5GCpH0T3D6oGpmDyI29";
    const style = basemap === "satelit" ? "hybrid" : "streets-v2";
    const ext = basemap === "satelit" ? "jpg" : "png";
    if (tilesRef.current) {
      map.removeLayer(tilesRef.current);
      tilesRef.current = null;
    }
    if (!key) return;
    tilesRef.current = L.tileLayer(`https://api.maptiler.com/maps/${style}/256/{z}/{x}/{y}.${ext}?key=${key}`, {
      maxZoom: 20,
      attribution: "",
    }).addTo(map);
  }, [basemap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    const L = LRef.current;
    if (!map || !layer || !L || !ready) return;
    layer.clearLayers();

    const byStaff = groupPoints(points, focusStaffId);
    const latestPins: [number, number][] = [];
    const allBounds: [number, number][] = [];

    for (const [staffId, list] of byStaff) {
      const ordered = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const color = colorOf(staffId);
      const nama = nameOf(staffId);
      const route = smoothRoute(ordered);
      const latlngs = route.map((point) => [point.lat, point.lng] as [number, number]);
      allBounds.push(...latlngs);
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color, weight: 4, opacity: 0.9 }).addTo(layer);
      }

      const latest = ordered[ordered.length - 1];
      if (!latest) continue;
      latestPins.push([latest.lat, latest.lng]);

      for (const point of trailPoints(ordered, latest)) {
        const important = point.kind !== "ping";
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: important ? 7 : 4,
          color: "#FFFFFF",
          weight: important ? 2 : 1,
          fillColor: important && (point.kind === "visit" || point.kind === "qris") ? "#60A5FA" : color,
          fillOpacity: important ? 0.95 : 0.7,
        }).addTo(layer);
        if (important) marker.on("click", () => onPointRef.current?.(point));
      }

      const acc = Math.min(Math.max(latest.accuracy_m || 30, 18), 90);
      L.circle([latest.lat, latest.lng], {
        radius: acc,
        color,
        weight: 1,
        opacity: 0.25,
        fillColor: color,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(layer);

      const gmaps = mapsUrl(latest.lat, latest.lng);
      const popupHtml = `<div style="min-width:150px;font:12px/1.4 system-ui,sans-serif">
        <strong>${escapeHtml(nama)}</strong><br/>
        Posisi terakhir<br/>
        <a href="${gmaps}" target="_blank" rel="noreferrer" style="color:#C5A358;font-weight:700">Buka di Google Maps</a>
      </div>`;

      L.circleMarker([latest.lat, latest.lng], {
        radius: 10,
        color: "#FFFFFF",
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      })
        .addTo(layer)
        .bindPopup(popupHtml)
        .on("click", () => onPointRef.current?.(latest));

      L.marker([latest.lat, latest.lng], {
        icon: L.divIcon({
          className: "henima-name-pin",
          html: `<div class="henima-name-chip"><span class="henima-name-dot" style="background:${color}"></span>${escapeHtml(nama)} · ${escapeHtml(initials(nama))}</div>`,
          iconSize: [120, 28],
          iconAnchor: [60, 42],
        }),
        interactive: true,
        keyboard: true,
      })
        .addTo(layer)
        .bindPopup(popupHtml)
        .on("click", () => onPointRef.current?.(latest));
    }

    const picked = focusPointId ? points.find((point) => point.id === focusPointId) : undefined;
    if (picked) map.setView([picked.lat, picked.lng], 17);
    else if (latestPins.length === 1) map.setView(latestPins[0], 16);
    else if (latestPins.length > 1) map.fitBounds(latestPins, { padding: [48, 48], maxZoom: 15 });
    else if (allBounds.length > 1) map.fitBounds(allBounds, { padding: [28, 28], maxZoom: 15 });
    else if (allBounds.length === 1) map.setView(allBounds[0], 16);
    else map.fitBounds(
      [
        [6.2, 95],
        [-11, 141],
      ],
      { padding: [12, 12] },
    );
    window.setTimeout(() => map.invalidateSize(), 40);
  }, [points, colorOf, nameOf, focusStaffId, focusPointId, ready]);

  function locateMe() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) {
      setLocateNote("Lokasi perangkat tidak tersedia.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 16);
        setLocateNote("");
      },
      () => setLocateNote("Izin lokasi ditolak."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return (
    <>
      <style>{`
        .henima-name-pin { background: transparent !important; border: 0 !important; }
        .henima-name-chip {
          display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
          border-radius: 999px; background: #fff; color: #0F172A; border: 1px solid #E2E8F0;
          box-shadow: 0 4px 14px rgba(15,23,42,0.12); font-size: 11px; font-weight: 700;
          padding: 4px 10px;
        }
        .henima-name-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
      `}</style>
      <div ref={host} className="henima-track-map absolute inset-0" />
      <MapChrome basemap={basemap} setBasemap={setBasemap} locateMe={locateMe} locateNote={locateNote} engine="MapTiler" />
    </>
  );
}

export function staffColor(index: number) {
  return COLORS[index % COLORS.length];
}
