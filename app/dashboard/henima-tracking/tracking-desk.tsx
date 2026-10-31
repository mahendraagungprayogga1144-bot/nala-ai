"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronDown,
  Users,
  Wifi,
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
    }, 25000);
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
    <div className="relative flex h-full min-h-0 text-[#0F172A]">
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
        <header className="relative z-40 flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] bg-white px-3 py-3 md:px-5">
          <button type="button" onClick={() => setNavOpen(true)} className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-xs font-semibold md:hidden">
            Menu
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama sales, lokasi atau tanggal..."
            className="h-10 min-w-[180px] flex-1 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium outline-none placeholder:text-[#94A3B8]"
          />
          <DayCalendar date={viewDate} today={today} marked={memory} onPick={(ymd) => void openDay(ymd)} />
          <span className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${viewDate === today ? "border-emerald-300 text-emerald-600" : "border-[#E2E8F0] text-[#64748B]"}`}>
            <Wifi size={15} />
            <span className="leading-tight">
              {dayBusy ? "Memuat..." : viewDate === today ? "Live Tracking" : "Arsip"}
              <span className="block text-[10px] font-medium text-[#64748B]">{aktif} sales aktif</span>
            </span>
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
        <div className="flex flex-wrap items-end justify-between gap-4 px-3 pt-5 md:px-5">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-[#0F172A]">Henima Tracking</h1>
            <p className="mt-1 text-sm font-medium text-[#64748B]">Pantau lokasi sales, rute perjalanan, dan foto check-in secara real-time.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Users size={16} />} label="Total Sales" value={String(links.length)} hint="Orang" />
            <Stat icon={<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />} label="Aktif" value={String(aktif)} hint="Sedang bekerja" tone="ok" />
            <Stat icon={<span className="text-sm font-bold text-amber-500">!</span>} label="Terlambat" value={String(late)} hint="Lewat 09:00" tone="late" />
            <Stat icon={<Camera size={16} />} label="Total Check-in" value={String(checkins)} hint={viewDate === today ? "Hari ini" : longDate(viewDate)} tone="photo" />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-3 pt-2 md:px-4">
          <button type="button" disabled={dayBusy} onClick={() => void openDay(shiftDay(viewDate, -1))} className="shrink-0 rounded-full border border-[#E2E8F0] px-2.5 py-1 text-xs font-semibold text-[#64748B] disabled:opacity-40">
            Sebelumnya
          </button>
          {viewDate !== today && (
            <button type="button" disabled={dayBusy} onClick={() => void openDay(today)} className="shrink-0 rounded-full border border-[#2563EB]/40 px-2.5 py-1 text-xs font-semibold text-[#2563EB] disabled:opacity-40">
              Hari ini
            </button>
          )}
          {memory.slice(0, 8).map((ymd) => (
            <button
              key={ymd}
              type="button"
              disabled={dayBusy}
              onClick={() => void openDay(ymd)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${ymd === viewDate ? "border-[#2563EB] text-[#2563EB]" : "border-[#E2E8F0] text-[#64748B]"}`}
            >
              {ymd === today ? "Hari ini" : longDate(ymd).replace(/ \d{4}$/, "")}
            </button>
          ))}
          {dayBusy && <span className="text-xs font-medium text-[#64748B]">Memuat tanggal...</span>}
        </div>
        {(notice || formError) && <p className="mx-3 mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:mx-4">{notice || formError}</p>}

        <div className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm md:mx-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#0F172A]">QRIS toko</p>
            <p className="text-xs font-medium text-[#64748B]">
              {qrisUrl
                ? "Sudah aktif di semua link sales lama. Sales check-in dulu, lalu tampilkan QRIS ke pelanggan."
                : "Wajib upload di sini dulu. Tanpa ini, link HP sales belum menampilkan QRIS."}
            </p>
          </div>
          {qrisUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrisUrl} alt="QRIS" className="h-14 w-14 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] object-contain p-1" />
          ) : (
            <span className="rounded-lg border border-dashed border-[#93C5FD] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#2563EB]">Belum diunggah</span>
          )}
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
            <button type="button" disabled={qrisBusy} onClick={() => void removeQris()} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-rose-600">
              Hapus
            </button>
          )}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 px-3 py-4 lg:grid-cols-[340px_1fr] md:px-5">
          <section className="flex max-h-[48vh] min-h-0 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-sm lg:max-h-none">
            <div className="flex items-center justify-between px-3 pt-3">
              <p className="text-sm font-bold">Filter Sales</p>
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
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
              <button
                type="button"
                onClick={() => setFocus("all")}
                className={`rounded-full px-3 py-1 text-xs font-bold ${focus === "all" ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] text-[#64748B]"}`}
              >
                Semua
              </button>
              {links.map((link) => (
                <button
                  key={link.staffId}
                  type="button"
                  onClick={() => setFocus(link.staffId)}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
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
            <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs font-medium text-[#64748B]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama sales..."
                className="h-8 min-w-0 flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs font-medium text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
              <label className="inline-flex items-center gap-1">
                Urutkan
                <select value={sort} onChange={(event) => setSort(event.target.value as "nama" | "terakhir")} className="bg-transparent font-semibold text-[#0F172A] outline-none">
                  <option value="nama">Nama</option>
                  <option value="terakhir">Terakhir</option>
                </select>
              </label>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {people.length === 0 && <p className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#64748B]">Tidak ada sales dengan nama itu.</p>}
              {people.map((link) => {
                const card = snapshot(link, viewPoints);
                return (
                  <article key={link.staffId} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: colorOf(link.staffId) }}>
                        {initials(link.nama)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-bold">{link.nama}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={card.status} />
                            <button type="button" onClick={() => setDetail(detail === link.staffId ? "" : link.staffId)} className="text-[11px] font-semibold text-[#2563EB]">
                              {detail === link.staffId ? "Tutup" : "Lihat Detail"}
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs font-medium text-[#64748B]">
                          {card.last ? `Sampai ${clock(card.last.recorded_at)} · ${card.visits.length} tempat` : "Belum ada titik"}
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#64748B]">Posisi terakhir</p>
                            <p className="truncate text-xs font-semibold">{card.last?.note || (card.last ? "Titik GPS tersimpan" : "Belum berangkat")}</p>
                            {card.last && <p className="text-[11px] font-medium text-[#64748B]">{ago(card.last.recorded_at)}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-semibold text-[#64748B]">Status</p>
                            <p className="text-xs font-bold">{card.out ? "Di Jalan" : "Offline"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFocus(link.staffId);
                          setFocusPointId(undefined);
                        }}
                        className="rounded-xl bg-[#2563EB] py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20"
                      >
                        Lihat di Peta
                      </button>
                      <button type="button" onClick={() => void copy(link)} className="rounded-xl border border-[#E2E8F0] bg-white py-2 text-xs font-semibold text-[#0F172A]">
                        {copied === link.staffId ? "Tersalin" : "Salin Link HP"}
                      </button>
                    </div>
                    {detail === link.staffId && (
                      <div className="mt-3 border-t border-[#E2E8F0] pt-2 text-xs text-[#64748B]">
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
                                <span>{KIND[point.kind]}{point.note ? ` · ${point.note}` : ""}{point.late ? " · telat" : ""}</span>
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

          <section className="flex min-h-0 flex-col gap-3">
            <div id="peta-tracking" className="relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
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
            <div id="foto-checkin" className="scroll-mt-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">{viewDate === today ? "Foto Check-in Hari Ini" : `Foto ${longDate(viewDate)}`}</h2>
                <button type="button" onClick={() => setFocus("all")} className="text-xs font-semibold text-[#2563EB]">
                  Lihat semua
                </button>
              </div>
              {photos.length === 0 ? (
                <p className="rounded-2xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm text-[#64748B] shadow-sm">
                  {viewDate === today ? "Foto muncul di sini setelah sales check-in atau mencatat tempat nawar." : "Tanggal ini belum ada foto."}
                </p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((point) => (
                    <li key={point.id} className="w-44 shrink-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                      <button type="button" onClick={() => setViewer(point)} className="block w-full text-left">
                        <Thumb src={point.photo_url || ""} />
                      </button>
                      <div className="p-2">
                        <p className="truncate text-xs font-bold">{nameOf(point.staff_id)}</p>
                        <p className="text-[11px] font-medium text-[#64748B]">{clock(point.recorded_at)} · {KIND[point.kind]}</p>
                        <p className="truncate text-[11px] text-[#64748B]">{point.note || "Titik GPS"}</p>
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
            </div>
          </section>
        </div>
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
                  <p className="text-xs font-medium text-[#64748B]">{clock(viewer.recorded_at)} · {KIND[viewer.kind]}</p>
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
  if (!src || bad) return <div className="flex h-[88px] items-center justify-center bg-[#F8FAFC] text-[11px] text-[#64748B]">Foto tidak tampil</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setBad(true)} className="h-[88px] w-full object-cover" />
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "late" | "photo";
}) {
  const iconBg =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "late"
        ? "bg-amber-50 text-amber-600"
        : tone === "photo"
          ? "bg-rose-50 text-rose-500"
          : "bg-[#EFF6FF] text-[#2563EB]";
  return (
    <div className="flex min-w-[148px] items-center gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>{icon}</span>
      <span>
        <span className="block text-[11px] font-semibold text-[#64748B]">{label}</span>
        <span className="block text-lg font-bold leading-5 text-[#0F172A]">
          {value} <span className="text-[11px] font-medium text-[#64748B]">{hint}</span>
        </span>
      </span>
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
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{status.label}</span>;
}
