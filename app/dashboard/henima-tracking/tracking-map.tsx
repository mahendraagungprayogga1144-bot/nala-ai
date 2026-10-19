"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { TrackingPoint } from "@/lib/henima-tracking/shared";

const COLORS = ["#00f0ff", "#d4af37", "#ff2bd6", "#7CFF6B", "#8B5CF6"];

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const KIND: Record<TrackingPoint["kind"], string> = {
  checkin_pagi: "Check-in",
  checkin_sore: "Check-out",
  visit: "Nawar",
  ping: "Jejak",
};

export default function TrackingMap({
  points,
  colorOf,
}: {
  points: TrackingPoint[];
  colorOf: (staffId: string) => string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    void (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;
      if (cancelled || !host.current) return;
      map = L.map(host.current, { zoomControl: true, attributionControl: true }).setView([-2.5, 118], 5);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);

      const byStaff = new Map<string, TrackingPoint[]>();
      for (const point of points) {
        const list = byStaff.get(point.staff_id) || [];
        list.push(point);
        byStaff.set(point.staff_id, list);
      }

      const bounds: [number, number][] = [];
      for (const [staffId, list] of byStaff) {
        const ordered = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
        const color = colorOf(staffId);
        const latlngs = ordered.map((point) => [point.lat, point.lng] as [number, number]);
        bounds.push(...latlngs);
        if (latlngs.length > 1) {
          L.polyline(latlngs, { color, weight: 3, opacity: 0.9 }).addTo(map);
        }
        for (const point of ordered) {
          const big = point.kind !== "ping";
          const marker = L.circleMarker([point.lat, point.lng], {
            radius: big ? 8 : 4,
            color,
            weight: 2,
            fillColor: point.kind === "visit" ? "#d4af37" : point.kind === "checkin_sore" ? "#ff2bd6" : color,
            fillOpacity: 0.95,
          }).addTo(map);
          const photo = point.photo_url
            ? `<img src="${esc(point.photo_url)}" alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-top:8px" />`
            : "";
          marker.bindPopup(
            `<div style="min-width:180px;font-family:inherit">
              <div style="font-size:11px;letter-spacing:.14em;color:${color}">${esc(KIND[point.kind])}</div>
              <div style="margin-top:4px;font-size:13px">${esc(point.note || "Tanpa catatan")}</div>
              <div style="margin-top:2px;font-size:11px;opacity:.7">${esc(clock(point.recorded_at))}</div>
              ${photo}
            </div>`,
          );
        }
      }
      if (bounds.length === 1) map.setView(bounds[0], 16);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, colorOf]);

  return <div ref={host} className="henima-track-map absolute inset-0" />;
}

export function staffColor(index: number) {
  return COLORS[index % COLORS.length];
}
