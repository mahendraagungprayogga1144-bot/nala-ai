"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { TrackingPoint } from "@/lib/henima-tracking/shared";

const COLORS = ["#00f0ff", "#d4af37", "#ff2bd6", "#7CFF6B", "#8B5CF6"];

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
    const style = basemap === "satelit" ? "satellite" : "streets-v2-dark";
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

    const bounds: [number, number][] = [];
    for (const [staffId, list] of byStaff) {
      if (focusStaffId && staffId !== focusStaffId) continue;
      const ordered = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const color = colorOf(staffId);
      const latlngs = ordered.map((point) => [point.lat, point.lng] as [number, number]);
      bounds.push(...latlngs);
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color, weight: 4, opacity: 0.9 }).addTo(layer);
      }
      const latest = ordered[ordered.length - 1];
      // Titik jejak ditipiskan supaya ganti hari tidak berat; garis rute tetap penuh.
      const markers = ordered.filter((point, index) => {
        if (point.kind !== "ping") return true;
        return index === 0 || index === ordered.length - 1 || index % 5 === 0;
      });
      for (const point of markers) {
        const big = point.kind !== "ping" || point === latest;
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: point === latest ? 11 : big ? 9 : 5,
          color,
          weight: 2,
          fillColor:
            point.kind === "visit" || point.kind === "qris"
              ? "#FFD34D"
              : point.kind === "checkin_sore"
                ? "#fb7185"
                : color,
          fillOpacity: 0.95,
        }).addTo(layer);
        marker.on("click", () => onPointRef.current?.(point));
      }
    }

    const picked = focusPointId ? points.find((point) => point.id === focusPointId) : undefined;
    if (picked) map.setView([picked.lat, picked.lng], 17);
    else if (bounds.length === 1) map.setView(bounds[0], 16);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28] });
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
    );
  }

  return (
    <>
      <div ref={host} className="henima-track-map absolute inset-0" />
      <div className="absolute right-3 top-3 z-[400] flex overflow-hidden rounded-xl border border-[#243247] bg-[#101827] text-xs font-semibold">
        <button type="button" onClick={() => setBasemap("peta")} className={`px-3 py-1.5 ${basemap === "peta" ? "bg-[#06D6D6] text-[#080D18]" : "text-[#94A3B8]"}`}>
          Peta
        </button>
        <button type="button" onClick={() => setBasemap("satelit")} className={`px-3 py-1.5 ${basemap === "satelit" ? "bg-[#06D6D6] text-[#080D18]" : "text-[#94A3B8]"}`}>
          Satelit
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-[#243247] bg-[#101827]/95 px-3 py-2 text-[11px] font-medium text-[#94A3B8]">
        <p className="mb-1 font-semibold text-[#F1F5F9]">Keterangan</p>
        <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#22E6A8]" />Posisi terakhir</p>
        <p className="mt-1"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#FFD34D]" />Tempat nawar</p>
        <p className="mt-1">Garis warna = rute orang itu</p>
      </div>
      <button type="button" onClick={locateMe} className="absolute bottom-3 right-3 z-[400] rounded-full border border-[#243247] bg-[#101827] px-3 py-2 text-xs font-semibold text-[#F1F5F9]">
        Lokasi saya
      </button>
      {locateNote && <p className="absolute bottom-14 right-3 z-[400] rounded-lg bg-[#101827] px-2 py-1 text-[11px] text-[#FFD34D]">{locateNote}</p>}
    </>
  );
}

export function staffColor(index: number) {
  return COLORS[index % COLORS.length];
}
