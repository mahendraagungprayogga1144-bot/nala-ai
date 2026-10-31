"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CalendarDays } from "lucide-react";
import { type TrackingLink, type TrackingPoint } from "@/lib/henima-tracking/shared";
import { staffColor } from "./tracking-map";
import { TrackingSidebar } from "./tracking-nav";

const KIND: Record<TrackingPoint["kind"], string> = {
  checkin_pagi: "Check-in",
  checkin_sore: "Check-out",
  visit: "Nawar",
  ping: "Jejak",
  qris: "QRIS",
};

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function shiftDay(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function longDate(ymd: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${ymd}T12:00:00+07:00`));
}

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

export default function RiwayatClient({
  date,
  today,
  days,
  links,
  points,
  ownerName,
  qrisUrl: initialQrisUrl,
}: {
  date: string;
  today: string;
  days: string[];
  links: TrackingLink[];
  points: TrackingPoint[];
  ownerName: string;
  qrisUrl?: string | null;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [focus, setFocus] = useState("all");
  const [historyKind, setHistoryKind] = useState<"all" | "qris" | "foto" | "checkin" | "visit">("all");
  const [viewer, setViewer] = useState<TrackingPoint | null>(null);
  const [clientDay, setClientDay] = useState<{ date: string; points: TrackingPoint[] } | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [error, setError] = useState("");
  const qrisUrl = initialQrisUrl || "";
  const viewDate = clientDay?.date ?? date;
  const viewPoints = clientDay?.points ?? points;
  const memory = days.includes(viewDate) ? days : [viewDate, ...days];

  const colorOf = useMemo(() => {
    const map = new Map(links.map((link, index) => [link.staffId, staffColor(index)]));
    return (staffId: string) => map.get(staffId) || "#2563EB";
  }, [links]);
  const nameOf = useMemo(() => {
    const map = new Map(links.map((link) => [link.staffId, link.nama]));
    return (staffId: string) => map.get(staffId) || "Sales";
  }, [links]);

  const scoped = (focus === "all" ? viewPoints : viewPoints.filter((point) => point.staff_id === focus)).filter(
    (point) => point.kind !== "ping",
  );
  const historyRows = scoped.filter((point) => {
    if (historyKind === "all") return true;
    if (historyKind === "qris") return point.kind === "qris";
    if (historyKind === "foto") return Boolean(point.photo_url) && point.kind !== "qris";
    if (historyKind === "checkin") return point.kind === "checkin_pagi" || point.kind === "checkin_sore";
    return point.kind === "visit";
  });
  const historyQris = scoped.filter((point) => point.kind === "qris").length;
  const historyFoto = scoped.filter((point) => point.photo_url && point.kind !== "qris").length;
  const historyCheckin = scoped.filter((point) => point.kind === "checkin_pagi" || point.kind === "checkin_sore").length;
  const historyVisit = scoped.filter((point) => point.kind === "visit").length;

  async function openDay(ymd: string) {
    const next = ymd > today ? today : ymd;
    if (next === viewDate || dayBusy) return;
    setDayBusy(true);
    setError("");
    try {
      const url = next === today ? "/api/henima-tracking/desk" : `/api/henima-tracking/desk?hari=${next}`;
      const response = await fetch(url, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal memuat tanggal itu.");
      setClientDay({ date: json.date || next, points: Array.isArray(json.points) ? json.points : [] });
      window.history.replaceState(
        null,
        "",
        next === today ? "/dashboard/henima-tracking/riwayat" : `/dashboard/henima-tracking/riwayat?hari=${next}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat tanggal.");
    } finally {
      setDayBusy(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 text-[#0F172A]">
      <TrackingSidebar active="riwayat" open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] bg-white px-3 py-3 md:px-5">
          <button type="button" onClick={() => setNavOpen(true)} className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs font-semibold md:hidden">
            Menu
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#2563EB]">HENIMA TRACKING</p>
            <h1 className="truncate text-xl font-bold text-[#0F172A]">Riwayat Perusahaan</h1>
          </div>
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#64748B]">
            <CalendarDays size={14} />
            {longDate(viewDate)}
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#64748B]" title="Belum ada notifikasi">
            <Bell size={16} />
          </span>
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-2 pr-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">{initials(ownerName)}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[120px] truncate text-xs font-bold">{ownerName}</span>
              <span className="block text-[10px] font-medium text-[#64748B]">Owner</span>
            </span>
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-3 pt-4 md:px-4">
            <p className="max-w-2xl text-sm font-medium text-[#64748B]">
              Semua data lapangan per tanggal: pembayaran QRIS, foto sales, check-in, tempat nawar, dan nama petugas.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto px-3 md:px-4">
            <button
              type="button"
              disabled={dayBusy}
              onClick={() => void openDay(shiftDay(viewDate, -1))}
              className="shrink-0 rounded-full border border-[#E2E8F0] px-2.5 py-1 text-xs font-semibold text-[#64748B] disabled:opacity-40"
            >
              Sebelumnya
            </button>
            {viewDate !== today && (
              <button
                type="button"
                disabled={dayBusy}
                onClick={() => void openDay(today)}
                className="shrink-0 rounded-full border border-[#2563EB]/40 px-2.5 py-1 text-xs font-semibold text-[#2563EB] disabled:opacity-40"
              >
                Hari ini
              </button>
            )}
            {memory.slice(0, 12).map((ymd) => (
              <button
                key={ymd}
                type="button"
                disabled={dayBusy}
                onClick={() => void openDay(ymd)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${
                  ymd === viewDate ? "border-[#2563EB] text-[#2563EB]" : "border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {ymd === today ? "Hari ini" : longDate(ymd).replace(/ \d{4}$/, "")}
              </button>
            ))}
          </div>

          {dayBusy && (
            <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm font-semibold text-[#2563EB] md:mx-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#BFDBFE] border-t-[#2563EB]" aria-hidden />
              Memuat data tanggal… sebentar ya.
            </div>
          )}

          {error && <p className="mx-3 mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:mx-4">{error}</p>}

          <div className={`mx-3 mt-3 flex flex-wrap gap-1.5 md:mx-4 ${dayBusy ? "pointer-events-none opacity-60" : ""}`}>
            <button
              type="button"
              onClick={() => setFocus("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${focus === "all" ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] text-[#64748B]"}`}
            >
              Semua sales
            </button>
            {links.map((link) => (
              <button
                key={link.staffId}
                type="button"
                onClick={() => setFocus(link.staffId)}
                className="rounded-full border px-3 py-1.5 text-xs font-bold"
                style={{
                  borderColor: colorOf(link.staffId),
                  color: focus === link.staffId ? "#FFFFFF" : colorOf(link.staffId),
                  background: focus === link.staffId ? colorOf(link.staffId) : "transparent",
                }}
              >
                {link.nama}
              </button>
            ))}
          </div>

          <section className={`mx-3 my-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm md:mx-5 ${dayBusy ? "pointer-events-none opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.18em] text-[#2563EB]">RIWAYAT LENGKAP</p>
                <h2 className="mt-1 text-base font-bold">{longDate(viewDate)}</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-[#BFDBFE] px-2.5 py-1 text-[#2563EB]">{historyQris} QRIS</span>
                <span className="rounded-full border border-[#fb7185]/35 px-2.5 py-1 text-rose-500">{historyFoto} foto</span>
                <span className="rounded-full border border-[#22E6A8]/35 px-2.5 py-1 text-emerald-600">{historyCheckin} check-in</span>
                <span className="rounded-full border border-[#BFDBFE] px-2.5 py-1 text-[#2563EB]">{historyVisit} nawar</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "qris", label: "Pembayaran QRIS" },
                  { id: "foto", label: "Foto" },
                  { id: "checkin", label: "Check-in" },
                  { id: "visit", label: "Nawar" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHistoryKind(item.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    historyKind === item.id ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] text-[#64748B]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {historyRows.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-[#64748B]">
                {viewDate === today
                  ? "Belum ada aktivitas untuk filter ini. Setelah sales check-in, tampilkan QRIS, atau foto nawar, datanya muncul di sini."
                  : `Tanggal ${longDate(viewDate)} belum ada data untuk filter ini.`}
              </p>
            ) : (
              <ul className="divide-y divide-[#E2E8F0] px-2 pb-2">
                {historyRows.map((point) => {
                  const thumb = point.kind === "qris" ? point.photo_url || qrisUrl : point.photo_url;
                  return (
                    <li key={point.id} className="flex gap-3 px-2 py-3">
                      <button
                        type="button"
                        disabled={!thumb}
                        onClick={() => thumb && setViewer({ ...point, photo_url: thumb })}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white disabled:cursor-default"
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] font-semibold text-[#64748B]">GPS</span>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: colorOf(point.staff_id) }}
                          >
                            {initials(nameOf(point.staff_id))}
                          </span>
                          <p className="truncate text-sm font-bold">{nameOf(point.staff_id)}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              point.kind === "qris"
                                ? "bg-amber-50 text-[#2563EB]"
                                : point.kind === "visit"
                                  ? "bg-[#EFF6FF] text-[#2563EB]"
                                  : point.kind.startsWith("checkin")
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-[#F8FAFC] text-[#64748B]"
                            }`}
                          >
                            {point.kind === "qris" ? "Pembayaran QRIS" : KIND[point.kind]}
                          </span>
                          {point.late && <span className="text-[10px] font-semibold text-rose-600">Telat</span>}
                        </div>
                        <p className="mt-1 text-xs font-medium text-[#0F172A]/90">
                          {point.kind === "qris"
                            ? `QRIS ditampilkan ke pembeli · atas nama ${nameOf(point.staff_id)}`
                            : point.note || "Titik GPS tersimpan"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#64748B]">
                          <span>
                            {longDate(viewDate)} · {clock(point.recorded_at)} WIB
                          </span>
                          <Link
                            href={viewDate === today ? "/dashboard/henima-tracking" : `/dashboard/henima-tracking?hari=${viewDate}`}
                            className="font-semibold text-[#2563EB]"
                          >
                            Buka di peta
                          </Link>
                          {thumb && (
                            <button type="button" onClick={() => setViewer({ ...point, photo_url: thumb })} className="font-semibold text-[#2563EB]">
                              Lihat gambar
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {viewer &&
        createPortal(
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setViewer(null)}>
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              {viewer.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.photo_url} alt="" className="max-h-[70vh] w-full bg-black object-contain" />
              ) : (
                <p className="px-4 py-10 text-center text-sm text-[#64748B]">Titik ini belum ada foto.</p>
              )}
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{nameOf(viewer.staff_id)}</p>
                  <p className="text-xs font-medium text-[#64748B]">
                    {clock(viewer.recorded_at)} · {KIND[viewer.kind]}
                  </p>
                  <p className="mt-1 text-xs text-[#64748B]">{viewer.note || "Titik GPS tersimpan"}</p>
                </div>
                <button type="button" onClick={() => setViewer(null)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold">
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
