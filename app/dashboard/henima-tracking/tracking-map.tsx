"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { TrackingPoint } from "@/lib/henima-tracking/shared";

const COLORS = ["#2563EB", "#0EA5E9", "#6366F1", "#0284C7", "#3B82F6"];

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

function agoLabel(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours} j ${rem} mnt` : `${hours} jam`;
  return `${Math.round(hours / 24)} hari lalu`;
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
  const [basemap, setBasemap] = useState<"peta" | "satelit">("satelit");
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
    // hybrid = satelit + label jalan biar titik mudah dikenali.
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
        L.polyline(latlngs, { color, weight: 5, opacity: 0.85 }).addTo(layer);
      }

      const latest = ordered[ordered.length - 1];
      if (!latest) continue;
      latestPins.push([latest.lat, latest.lng]);

      // Jejak kecil di belakang; titik penting (nawar/check-in/qris) lebih tebal.
      const trail = ordered.filter((point, index) => {
        if (point === latest) return false;
        if (point.kind !== "ping") return true;
        return index === 0 || index % 4 === 0;
      });
      for (const point of trail) {
        const important = point.kind !== "ping";
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: important ? 7 : 4,
          color: "#FFFFFF",
          weight: 2,
          fillColor:
            point.kind === "visit" || point.kind === "qris"
              ? "#F59E0B"
              : point.kind === "checkin_sore"
                ? "#F43F5E"
                : color,
          fillOpacity: important ? 0.95 : 0.7,
        }).addTo(layer);
        marker.on("click", () => onPointRef.current?.(point));
      }

      // Lingkaran akurasi GPS di posisi terakhir.
      const radius = Math.min(Math.max(latest.accuracy_m || 35, 20), 120);
      L.circle([latest.lat, latest.lng], {
        radius,
        color,
        weight: 1,
        opacity: 0.35,
        fillColor: color,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(layer);

      const safeName = escapeHtml(nama);
      const safeAgo = escapeHtml(agoLabel(latest.recorded_at));
      const pin = L.marker([latest.lat, latest.lng], {
        icon: L.divIcon({
          className: "henima-live-pin",
          html: `<div class="henima-pin-wrap">
            <div class="henima-pin-badge">${safeName} · ${safeAgo}</div>
            <div class="henima-pin-dot" style="background:${color};border-color:${color}">
              <span>${escapeHtml(initials(nama))}</span>
            </div>
            <div class="henima-pin-pulse" style="border-color:${color}"></div>
          </div>`,
          iconSize: [44, 64],
          iconAnchor: [22, 58],
        }),
        zIndexOffset: 1000,
      }).addTo(layer);
      pin.on("click", () => onPointRef.current?.(latest));
    }

    const picked = focusPointId ? points.find((point) => point.id === focusPointId) : undefined;
    if (picked) {
      map.setView([picked.lat, picked.lng], 18);
    } else if (latestPins.length === 1) {
      map.setView(latestPins[0], 17);
    } else if (latestPins.length > 1) {
      map.fitBounds(latestPins, { padding: [48, 48], maxZoom: 16 });
    } else if (allBounds.length > 1) {
      map.fitBounds(allBounds, { padding: [28, 28], maxZoom: 16 });
    } else if (allBounds.length === 1) {
      map.setView(allBounds[0], 17);
    } else {
      map.fitBounds(
        [
          [6.2, 95],
          [-11, 141],
        ],
        { padding: [12, 12] },
      );
    }
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
        map.setView([pos.coords.latitude, pos.coords.longitude], 17);
        setLocateNote("");
      },
      () => setLocateNote("Izin lokasi ditolak."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return (
    <>
      <style>{`
        .henima-live-pin { background: transparent !important; border: 0 !important; }
        .henima-pin-wrap { position: relative; width: 44px; height: 64px; pointer-events: auto; }
        .henima-pin-badge {
          position: absolute; left: 50%; bottom: 52px; transform: translateX(-50%);
          white-space: nowrap; border-radius: 999px; background: #fff; color: #0F172A;
          border: 1px solid #E2E8F0; box-shadow: 0 6px 18px rgba(15,23,42,0.16);
          font-size: 11px; font-weight: 700; padding: 4px 10px; z-index: 2;
        }
        .henima-pin-dot {
          position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%);
          width: 40px; height: 40px; border-radius: 999px; border: 3px solid #fff;
          box-shadow: 0 8px 20px rgba(15,23,42,0.28); display: flex; align-items: center;
          justify-content: center; color: #fff; font-size: 12px; font-weight: 800; z-index: 2;
        }
        .henima-pin-pulse {
          position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%);
          width: 48px; height: 48px; border-radius: 999px; border: 2px solid;
          opacity: 0.35; animation: henima-pulse 2s ease-out infinite; z-index: 1;
        }
        @keyframes henima-pulse {
          0% { transform: translateX(-50%) scale(0.85); opacity: 0.45; }
          100% { transform: translateX(-50%) scale(1.55); opacity: 0; }
        }
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
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#2563EB]" />
          Posisi live sales
        </p>
        <p className="mt-1">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#F59E0B]" />
          Tempat nawar / QRIS
        </p>
        <p className="mt-1">Lingkaran = akurasi GPS</p>
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
