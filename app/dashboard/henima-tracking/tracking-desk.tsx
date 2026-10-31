"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { type TrackingLink, type TrackingPoint } from "@/lib/henima-tracking/shared";
import TrackingMap, { staffColor } from "./tracking-map";
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

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
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

function snapshot(link: TrackingLink, points: TrackingPoint[]) {
  const mine = points.filter((point) => point.staff_id === link.staffId);
  const pagi = mine.find((point) => point.kind === "checkin_pagi");
  const sore = mine.find((point) => point.kind === "checkin_sore");
  const visits = mine.filter((point) => point.kind === "visit");
  const last = mine[0];
  const out = Boolean(pagi && !sore);
  const status = !out
    ? { label: "Offline", tone: "off" as const }
    : pagi?.late
      ? { label: "Terlambat", tone: "late" as const }
      : { label: "Aktif", tone: "road" as const };
  return { mine, pagi, sore, visits, last, status, out };
}

export default function TrackingDesk({
  date,
  today,
  days,
  links,
  points,
  notice,
  ownerName,
  qrisUrl: initialQrisUrl,
}: {
  date: string;
  today: string;
  days: string[];
  links: TrackingLink[];
  points: TrackingPoint[];
  notice?: string;
  ownerName: string;
  qrisUrl?: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState("");
  const [focus, setFocus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState("");
  const [sort, setSort] = useState<"nama" | "terakhir">("nama");
  const [nama, setNama] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [viewer, setViewer] = useState<TrackingPoint | null>(null);
  const [focusPointId, setFocusPointId] = useState<string | undefined>();
  const [clientDay, setClientDay] = useState<{ date: string; points: TrackingPoint[] } | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [qrisUrl, setQrisUrl] = useState(initialQrisUrl || "");
  const [qrisBusy, setQrisBusy] = useState(false);
  const viewDate = clientDay?.date ?? date;
  const viewPoints = clientDay?.points ?? points;

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (viewDate !== today) return;
    const timer = window.setInterval(() => {
      void fetch("/api/henima-tracking/desk", { cache: "no-store" })
        .then((response) => response.json())
        .then((json) => {
          if (Array.isArray(json.points)) setClientDay({ date: json.date || today, points: json.points });
        })
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [viewDate, today]);

  const colorOf = useMemo(() => {
    const map = new Map(links.map((link, index) => [link.staffId, staffColor(index)]));
    return (staffId: string) => map.get(staffId) || "#2563EB";
  }, [links]);
  const nameOf = useMemo(() => {
    const map = new Map(links.map((link) => [link.staffId, link.nama]));
    return (staffId: string) => map.get(staffId) || "Sales";
  }, [links]);

  const needle = query.trim().toLowerCase();
  const people = links
    .filter((link) => {
      if (!needle) return true;
      const last = viewPoints.find((point) => point.staff_id === link.staffId);
      return link.nama.toLowerCase().includes(needle) || (last?.note || "").toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      if (sort === "nama") return a.nama.localeCompare(b.nama, "id");
      const ta = viewPoints.find((point) => point.staff_id === a.staffId)?.recorded_at || "";
      const tb = viewPoints.find((point) => point.staff_id === b.staffId)?.recorded_at || "";
      return tb.localeCompare(ta);
    });
  const visible = (focus === "all" ? viewPoints : viewPoints.filter((point) => point.staff_id === focus)).filter((point) =>
    people.some((link) => link.staffId === point.staff_id),
  );
  // QRIS tetap di riwayat kartu sales, jangan campur ke strip foto di bawah peta.
  const photos = visible.filter((point) => point.photo_url && point.kind !== "qris");
  const aktif = links.filter((link) => snapshot(link, viewPoints).out).length;
  const late = links.filter((link) => snapshot(link, viewPoints).status.tone === "late").length;
  const checkins = viewPoints.filter((point) => point.kind === "checkin_pagi").length;
  const memory = days.includes(viewDate) ? days : [viewDate, ...days];

  async function openDay(ymd: string) {
    const next = ymd > today ? today : ymd;
    if (next === viewDate || dayBusy) return;
    setDayBusy(true);
    setFormError("");
    setFocus("all");
    setFocusPointId(undefined);
    try {
      const url = next === today ? "/api/henima-tracking/desk" : `/api/henima-tracking/desk?hari=${next}`;
      const response = await fetch(url, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal memuat tanggal itu.");
      setClientDay({ date: json.date || next, points: Array.isArray(json.points) ? json.points : [] });
      window.history.replaceState(null, "", next === today ? "/dashboard/henima-tracking" : `/dashboard/henima-tracking?hari=${next}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal memuat tanggal.");
    } finally {
      setDayBusy(false);
    }
  }

  async function copy(link: TrackingLink) {
    await navigator.clipboard.writeText(`${window.location.origin}${link.path}`);
    setCopied(link.staffId);
  }

  async function uploadQris(file: File | null) {
    if (!file) return;
    setQrisBusy(true);
    setFormError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/henima-tracking/qris", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Upload QRIS gagal.");
      setQrisUrl(json.qrisUrl || "");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload QRIS gagal.");
    } finally {
      setQrisBusy(false);
    }
  }

  async function removeQris() {
    if (!window.confirm("Hapus gambar QRIS dari link sales?")) return;
    setQrisBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/henima-tracking/qris", { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal menghapus QRIS.");
      setQrisUrl("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menghapus QRIS.");
    } finally {
      setQrisBusy(false);
    }
  }

  async function addSales() {
    const name = nama.trim();
    if (!name) return;
    setAdding(true);
    setFormError("");
    try {
      const created = await fetch("/api/sales/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: name, role: "SALES" }),
      });
      const json = await created.json();
      if (!created.ok) throw new Error(json.error || "Gagal menambah sales.");
      const activated = await fetch("/api/sales/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", staffId: json.id, status: "active" }),
      });
      const activatedJson = await activated.json();
      if (!activated.ok) throw new Error(activatedJson.error || "Sales tercatat, tetapi belum bisa check-in.");
      setNama("");
      setClientDay(null);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menambah sales.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(link: TrackingLink) {
    if (!window.confirm(`Hapus ${link.nama} dari daftar ini? Link check-in HP-nya ikut mati.`)) return;
    setFormError("");
    const response = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", staffId: link.staffId, status: "disabled" }),
    });
    const json = await response.json();
    if (!response.ok) {
      setFormError(json.error || "Gagal menghapus.");
      return;
    }
    if (focus === link.staffId) setFocus("all");
    setClientDay(null);
    router.refresh();
  }

  async function activate(staffId: string) {
    setFormError("");
    const response = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", staffId, status: "active" }),
    });
    const json = await response.json();
    if (!response.ok) {
      setFormError(json.error || "Gagal mengaktifkan sales.");
      return;
    }
    setClientDay(null);
    router.refresh();
  }

  return (
    <div className="relative flex h-full min-h-0 bg-[#F8FAFC] text-[#0F172A]">
      <style>{`
        .henima-track-map .leaflet-control-zoom { border: 0; margin-top: 12px !important; margin-left: 12px !important; box-shadow: 0 1px 3px rgba(15,23,42,0.08); }
        .henima-track-map .leaflet-control-zoom a { background:#FFFFFF; color:#0F172A; border-color:#E2E8F0; width: 32px; height: 32px; line-height: 32px; }
        .henima-track-map .leaflet-popup-content-wrapper, .henima-track-map .leaflet-popup-tip { background:#FFFFFF; color:#0F172A; }
        .henima-track-map .leaflet-container { background:#F8FAFC; font-family: inherit; }
        .henima-track-map .leaflet-interactive { cursor: pointer; }
        .henima-track-map .leaflet-control-attribution { display: none !important; }
      `}</style>

      <TrackingSidebar active="tracking" open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <button type="button" onClick={() => setNavOpen(true)} className="mt-1 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs font-semibold md:hidden">
              Menu
            </button>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight text-[#0F172A] md:text-[26px]">Henima Tracking</h1>
              <p className="mt-0.5 text-sm font-medium text-[#64748B]">Pantau lokasi sales, rute perjalanan, dan foto check-in secara real-time.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DayCalendar date={viewDate} today={today} marked={memory} onPick={(ymd) => void openDay(ymd)} />
            <span
              className={`inline-flex h-10 items-center gap-2 rounded-full border bg-white px-3 text-sm font-semibold ${
                viewDate === today ? "border-emerald-200 text-emerald-600" : "border-[#E2E8F0] text-[#64748B]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${viewDate === today ? "bg-emerald-500" : "bg-slate-300"}`} />
              {dayBusy ? "Memuat..." : viewDate === today ? "Live Tracking" : "Arsip"}
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
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total Sales" value={String(links.length)} hint="Orang" tone="blue" />
            <Stat label="Aktif" value={String(aktif)} hint="sedang bekerja" tone="ok" />
            <Stat label="Terlambat" value={String(late)} hint="Lewat 09:00" tone="late" />
            <Stat label="Total Check-in" value={String(checkins)} hint={viewDate === today ? "Hari ini" : longDate(viewDate)} tone="photo" />
          </div>

          {(notice || formError) && (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{notice || formError}</p>
          )}

          <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-4">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">QRIS toko</p>
                    <p className="mt-1 text-xs font-medium text-[#64748B]">
                      {qrisUrl ? "Gambar ini muncul di link sales." : "Upload QRIS agar muncul di link HP sales."}
                    </p>
                  </div>
                  {qrisUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrisUrl} alt="QRIS" className="h-20 w-20 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] object-contain p-1" />
                  ) : (
                    <span className="rounded-xl border border-dashed border-[#93C5FD] bg-[#EFF6FF] px-3 py-6 text-[11px] font-semibold text-[#2563EB]">Belum ada</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20">
                    {qrisBusy ? "..." : qrisUrl ? "Ganti QRIS" : "Upload QRIS"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={qrisBusy}
                      onChange={(event) => void uploadQris(event.target.files?.[0] || null)}
                    />
                  </label>
                  {qrisUrl && (
                    <>
                      <a
                        href={qrisUrl}
                        download="qris-toko.jpg"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A]"
                      >
                        Download QRIS
                      </a>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(qrisUrl)}
                        className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A]"
                      >
                        Bagikan
                      </button>
                      <button type="button" disabled={qrisBusy} onClick={() => void removeQris()} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-rose-600">
                        Hapus
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-sm lg:max-h-[calc(100vh-28rem)]">
                <div className="flex items-center justify-between px-4 pt-4">
                  <p className="text-sm font-bold text-[#0F172A]">Filter Sales</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFocus("all");
                    }}
                    className="text-xs font-semibold text-[#64748B]"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setFocus("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${focus === "all" ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] text-[#64748B]"}`}
                  >
                    Semua
                  </button>
                  {links.map((link) => (
                    <button
                      key={link.staffId}
                      type="button"
                      onClick={() => setFocus(link.staffId)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        focus === link.staffId ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] text-[#64748B]"
                      }`}
                    >
                      {link.nama}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-4 pb-3 text-xs font-medium text-[#64748B]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama sales..."
                    className="h-9 min-w-0 flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs font-medium text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                  />
                  <label className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-2 py-2">
                    Urutkan
                    <select value={sort} onChange={(event) => setSort(event.target.value as "nama" | "terakhir")} className="bg-transparent font-semibold text-[#0F172A] outline-none">
                      <option value="nama">Nama</option>
                      <option value="terakhir">Terakhir</option>
                    </select>
                  </label>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                  {people.length === 0 && <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#64748B]">Tidak ada sales dengan nama itu.</p>}
                  {people.map((link) => {
                    const card = snapshot(link, viewPoints);
                    return (
                      <article key={link.staffId} className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
                        <div className="flex gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-sm font-bold text-[#2563EB]">
                            {initials(link.nama)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-bold text-[#0F172A]">{link.nama}</p>
                              <StatusBadge status={card.status} />
                            </div>
                            <p className="mt-1 text-xs font-medium text-[#64748B]">
                              {card.last ? `Posisi terakhir · ${ago(card.last.recorded_at)}` : "Belum berangkat"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#0F172A]">{card.out ? "Di Jalan" : "Offline"}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFocus(link.staffId);
                              setFocusPointId(undefined);
                            }}
                            className="rounded-xl bg-[#1E3A8A] py-2.5 text-xs font-bold text-white"
                          >
                            Lihat di Peta
                          </button>
                          <button type="button" onClick={() => void copy(link)} className="rounded-xl border border-[#E2E8F0] bg-white py-2.5 text-xs font-semibold text-[#0F172A]">
                            {copied === link.staffId ? "Tersalin" : "Salin Link HP"}
                          </button>
                        </div>
                        <button type="button" onClick={() => setDetail(detail === link.staffId ? "" : link.staffId)} className="mt-2 text-[11px] font-semibold text-[#2563EB]">
                          {detail === link.staffId ? "Tutup detail" : "Lihat detail"}
                        </button>
                        {detail === link.staffId && (
                          <div className="mt-2 border-t border-[#E2E8F0] pt-2 text-xs text-[#64748B]">
                            {link.status !== "active" ? (
                              <button type="button" onClick={() => void activate(link.staffId)} className="mb-2 w-full rounded-xl border border-[#E2E8F0] py-2 font-semibold text-[#0F172A]">
                                Aktifkan untuk check-in
                              </button>
                            ) : link.token ? (
                              <a href={link.path} target="_blank" rel="noreferrer" className="mb-2 block text-center font-semibold text-[#2563EB]">
                                Coba di HP saya
                              </a>
                            ) : null}
                            <ul className="space-y-1">
                              {card.mine.filter((point) => point.kind !== "ping").length === 0 && <li>Belum ada check-in atau tempat nawar.</li>}
                              {card.mine
                                .filter((point) => point.kind !== "ping")
                                .map((point) => (
                                  <li key={point.id} className="flex justify-between gap-2">
                                    <span>
                                      {KIND[point.kind]}
                                      {point.note ? ` · ${point.note}` : ""}
                                      {point.late ? " · telat" : ""}
                                    </span>
                                    <span>{clock(point.recorded_at)}</span>
                                  </li>
                                ))}
                            </ul>
                            {link.role !== "FOUNDER" && (
                              <button type="button" onClick={() => void remove(link)} className="mt-2 font-semibold text-rose-600">
                                Hapus
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  <form
                    id="tambah-sales"
                    className="flex scroll-mt-3 gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void addSales();
                    }}
                  >
                    <input
                      value={nama}
                      onChange={(event) => setNama(event.target.value)}
                      placeholder="Nama sales baru"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none"
                    />
                    <button type="submit" disabled={adding || !nama.trim()} className="rounded-xl bg-[#2563EB] px-3 text-xs font-bold text-white disabled:opacity-40">
                      {adding ? "..." : "Tambah"}
                    </button>
                  </form>
                </div>
              </section>
            </div>

            <div className="flex min-h-0 flex-col gap-4">
              <div id="peta-tracking" className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm lg:min-h-[520px]">
                <TrackingMap
                  points={visible}
                  colorOf={colorOf}
                  nameOf={nameOf}
                  focusStaffId={focus === "all" ? undefined : focus}
                  focusPointId={focusPointId}
                  onPoint={setViewer}
                />
                {visible.length === 0 && (
                  <p className="pointer-events-none absolute left-1/2 top-16 z-[400] w-[min(280px,80%)] -translate-x-1/2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-center text-xs font-medium text-[#64748B] shadow-sm">
                    Belum ada jejak pada tanggal ini.
                  </p>
                )}
              </div>

              <section id="foto-checkin" className="scroll-mt-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#0F172A]">{viewDate === today ? "Foto Check-in Hari Ini" : `Foto ${longDate(viewDate)}`}</h2>
                  <button type="button" onClick={() => setFocus("all")} className="text-xs font-semibold text-[#2563EB]">
                    Lihat semua
                  </button>
                </div>
                {photos.length === 0 ? (
                  <p className="rounded-xl bg-[#F8FAFC] px-3 py-4 text-sm text-[#64748B]">
                    {viewDate === today ? "Foto muncul di sini setelah sales check-in atau mencatat tempat nawar." : "Tanggal ini belum ada foto."}
                  </p>
                ) : (
                  <ul className="flex gap-3 overflow-x-auto pb-1">
                    {photos.map((point) => (
                      <li key={point.id} className="w-48 shrink-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
                        <button type="button" onClick={() => setViewer(point)} className="block w-full text-left">
                          <Thumb src={point.photo_url || ""} />
                        </button>
                        <div className="p-2.5">
                          <p className="truncate text-xs font-bold text-[#0F172A]">{nameOf(point.staff_id)}</p>
                          <p className="text-[11px] font-medium text-[#64748B]">
                            {clock(point.recorded_at)} · {KIND[point.kind]}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFocus(point.staff_id);
                              setFocusPointId(point.id);
                              document.getElementById("peta-tracking")?.scrollIntoView({ block: "nearest" });
                            }}
                            className="mt-1 text-[11px] font-semibold text-[#2563EB]"
                          >
                            Lihat di peta
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {viewer &&
        createPortal(
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setViewer(null)}>
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              {viewer.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.photo_url} alt="" className="max-h-[70vh] w-full bg-slate-950 object-contain" />
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
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFocus(viewer.staff_id);
                      setFocusPointId(viewer.id);
                      setViewer(null);
                      document.getElementById("peta-tracking")?.scrollIntoView({ block: "nearest" });
                    }}
                    className="rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-bold text-white"
                  >
                    Lihat di peta
                  </button>
                  <button type="button" onClick={() => setViewer(null)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold">
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function shiftMonth(ym: string, delta: number) {
  const [year, month] = ym.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthCells(year: number, month: number) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (firstDow + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

function DayCalendar({
  date,
  today,
  marked,
  onPick,
}: {
  date: string;
  today: string;
  marked: string[];
  onPick: (ymd: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));
  const [place, setPlace] = useState({ top: 0, left: 0 });
  const markedSet = useMemo(() => new Set(marked), [marked]);

  function placePanel() {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    const width = 292;
    const left = Math.min(Math.max(12, box.right - width), window.innerWidth - width - 12);
    setPlace({ top: box.bottom + 8, left });
  }

  useEffect(() => {
    if (!open) return;
    placePanel();
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    }
    function onMove() {
      placePanel();
    }
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const [year, mon] = month.split("-").map(Number);
  const title = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, mon - 1, 1)),
  );
  const canNext = month < today.slice(0, 7);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setMonth(date.slice(0, 7));
          setOpen((value) => {
            if (!value) placePanel();
            return !value;
          });
        }}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-semibold"
      >
        <CalendarDays size={15} className="text-[#64748B]" />
        {longDate(date)}
        <ChevronDown size={14} className={`text-[#64748B] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            style={{ top: place.top, left: place.left }}
            className="fixed z-[5000] w-[292px] rounded-2xl border border-[#E2E8F0] bg-white p-3 text-[#0F172A] shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#0F172A]" aria-label="Bulan sebelumnya">
                ‹
              </button>
              <p className="text-sm font-bold capitalize">{title}</p>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => canNext && setMonth((value) => shiftMonth(value, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#0F172A] disabled:opacity-30"
                aria-label="Bulan berikutnya"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#64748B]">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((label) => (
                <span key={label} className="py-1">{label}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthCells(year, mon).map((ymd, index) => {
                if (!ymd) return <span key={`empty-${index}`} />;
                const disabled = ymd > today;
                const selected = ymd === date;
                const isToday = ymd === today;
                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onPick(ymd);
                      setOpen(false);
                    }}
                    className={`relative flex h-9 items-center justify-center rounded-lg text-sm font-semibold ${
                      selected
                        ? "bg-[#2563EB] text-white"
                        : isToday
                          ? "border border-[#2563EB] text-[#2563EB]"
                          : "text-[#0F172A] hover:bg-[#EFF6FF]"
                    } disabled:cursor-default disabled:text-[#475569] disabled:hover:bg-transparent`}
                  >
                    {Number(ymd.slice(8))}
                    {markedSet.has(ymd) && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#2563EB]" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="flex h-[100px] items-center justify-center bg-[#F1F5F9] text-[11px] text-[#64748B]">Foto tidak tampil</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setBad(true)} className="h-[100px] w-full object-cover" />
  );
}

function Spark() {
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16 text-[#2563EB]" aria-hidden>
      <path d="M1 18 L12 14 L22 16 L32 8 L42 12 L52 4 L63 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "blue" | "ok" | "late" | "photo";
}) {
  const accent =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "late"
        ? "text-amber-600"
        : tone === "photo"
          ? "text-rose-500"
          : "text-[#2563EB]";
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none text-[#0F172A]">
            {value} <span className={`text-xs font-semibold ${accent}`}>{hint}</span>
          </p>
        </div>
        <Spark />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: { label: string; tone: "off" | "road" | "late" } }) {
  const cls =
    status.tone === "road"
      ? "bg-emerald-50 text-emerald-600"
      : status.tone === "late"
        ? "bg-amber-50 text-amber-600"
        : "bg-[#F1F5F9] text-[#64748B]";
  const label = status.tone === "road" ? "Terlihat" : status.label;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}
