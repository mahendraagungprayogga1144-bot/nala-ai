"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { TrackingPoint } from "@/lib/henima-tracking/shared";

const COLORS = ["#2563EB", "#3B82F6", "#1D4ED8", "#0EA5E9", "#6366F1"];

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

    const byStaff = new Map<string, TrackingPoint[]>();
    for (const point of points) {
      const list = byStaff.get(point.staff_id) || [];
      list.push(point);
      byStaff.set(point.staff_id, list);
    }

    const latestPins: [number, number][] = [];
    const allBounds: [number, number][] = [];

    for (const [staffId, list] of byStaff) {
      if (focusStaffId && staffId !== focusStaffId) continue;
      const ordered = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const color = colorOf(staffId);
      const nama = nameOf(staffId);
      const latlngs = ordered.map((point) => [point.lat, point.lng] as [number, number]);
      allBounds.push(...latlngs);
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color, weight: 4, opacity: 0.9 }).addTo(layer);
      }

      const latest = ordered[ordered.length - 1];
      if (!latest) continue;
      latestPins.push([latest.lat, latest.lng]);

      // Ping tipis saja — terlalu banyak marker bikin ganti tanggal / live refresh berat.
      const trail = ordered.filter((point, index) => {
        if (point === latest) return false;
        if (point.kind !== "ping") return true;
        return index === 0 || index % 6 === 0;
      });
      const capped = trail.length > 80 ? trail.filter((_, index) => index % Math.ceil(trail.length / 80) === 0) : trail;

      for (const point of capped) {
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

      L.circleMarker([latest.lat, latest.lng], {
        radius: 10,
        color: "#FFFFFF",
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      })
        .addTo(layer)
        .on("click", () => onPointRef.current?.(latest));

      L.marker([latest.lat, latest.lng], {
        icon: L.divIcon({
          className: "henima-name-pin",
          html: `<div class="henima-name-chip"><span class="henima-name-dot" style="background:${color}"></span>${escapeHtml(nama)} · ${escapeHtml(initials(nama))}</div>`,
          iconSize: [120, 28],
          iconAnchor: [60, 42],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(layer);
    }

    const picked = focusPointId ? points.find((point) => point.id === focusPointId) : undefined;
    if (picked) map.setView([picked.lat, picked.lng], 17);
    else if (latestPins.length === 1) map.setView(latestPins[0], 16);
    else if (latestPins.length > 1) map.fitBounds(latestPins, { padding: [48, 48], maxZoom: 15 });
    else if (allBounds.length > 1) map.fitBounds(allBounds, { padding: [28, 28], maxZoom: 15 });
    else if (allBounds.length === 1) map.setView(allBounds[0], 16);
    else map.fitBounds([[6.2, 95], [-11, 141]], { padding: [12, 12] });
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
      <div className="absolute right-3 top-3 z-[400] flex overflow-hidden rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold shadow-sm">
        <button type="button" onClick={() => setBasemap("peta")} className={`px-3 py-1.5 ${basemap === "peta" ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>
          Peta
        </button>
        <button type="button" onClick={() => setBasemap("satelit")} className={`px-3 py-1.5 ${basemap === "satelit" ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>
          Satelit
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-2 text-[11px] font-medium text-[#64748B] shadow-sm">
        <p className="mb-1 font-semibold text-[#0F172A]">Keterangan</p>
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

export function staffColor(index: number) {
  return COLORS[index % COLORS.length];
}
