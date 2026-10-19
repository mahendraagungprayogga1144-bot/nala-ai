"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronDown,
  FileBarChart,
  History,
  LayoutDashboard,
  MapPinned,
  Settings,
  Users,
  Wifi,
} from "lucide-react";
import { type TrackingLink, type TrackingPoint } from "@/lib/henima-tracking/shared";
import TrackingMap, { staffColor } from "./tracking-map";

const KIND: Record<TrackingPoint["kind"], string> = {
  checkin_pagi: "Check-in",
  checkin_sore: "Check-out",
  visit: "Nawar",
  ping: "Jejak",
};

const NAV = [
  { href: "/dashboard/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/henima-tracking", label: "Tracking", icon: MapPinned, active: true },
  { href: "/dashboard/sales", label: "Sales", icon: Users },
  { href: "#foto-checkin", label: "Foto Check-in", icon: Camera },
  { href: "#riwayat", label: "Riwayat", icon: History },
  { href: "/dashboard/sales/reports", label: "Laporan", icon: FileBarChart },
  { href: "#tambah-sales", label: "Pengaturan", icon: Settings },
];

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
}: {
  date: string;
  today: string;
  days: string[];
  links: TrackingLink[];
  points: TrackingPoint[];
  notice?: string;
  ownerName: string;
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

  useEffect(() => {
    if (date !== today) return;
    const timer = window.setInterval(() => router.refresh(), 25000);
    return () => window.clearInterval(timer);
  }, [router, date, today]);

  const colorOf = useMemo(() => {
    const map = new Map(links.map((link, index) => [link.staffId, staffColor(index)]));
    return (staffId: string) => map.get(staffId) || "#06D6D6";
  }, [links]);
  const nameOf = useMemo(() => {
    const map = new Map(links.map((link) => [link.staffId, link.nama]));
    return (staffId: string) => map.get(staffId) || "Sales";
  }, [links]);

  const needle = query.trim().toLowerCase();
  const people = links
    .filter((link) => {
      if (!needle) return true;
      const last = points.find((point) => point.staff_id === link.staffId);
      return link.nama.toLowerCase().includes(needle) || (last?.note || "").toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      if (sort === "nama") return a.nama.localeCompare(b.nama, "id");
      const ta = points.find((point) => point.staff_id === a.staffId)?.recorded_at || "";
      const tb = points.find((point) => point.staff_id === b.staffId)?.recorded_at || "";
      return tb.localeCompare(ta);
    });
  const visible = (focus === "all" ? points : points.filter((point) => point.staff_id === focus)).filter((point) =>
    people.some((link) => link.staffId === point.staff_id),
  );
  const photos = visible.filter((point) => point.photo_url);
  const aktif = links.filter((link) => snapshot(link, points).out).length;
  const late = links.filter((link) => snapshot(link, points).status.tone === "late").length;
  const checkins = points.filter((point) => point.kind === "checkin_pagi").length;
  const memory = days.includes(date) ? days : [date, ...days];

  function openDay(ymd: string) {
    const next = ymd > today ? today : ymd;
    router.push(next === today ? "/dashboard/henima-tracking" : `/dashboard/henima-tracking?hari=${next}`);
  }

  async function copy(link: TrackingLink) {
    await navigator.clipboard.writeText(`${window.location.origin}${link.path}`);
    setCopied(link.staffId);
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
    router.refresh();
  }

  return (
    <div className="relative flex h-full min-h-0 text-[#F1F5F9]">
      <style>{`
        .henima-track-map .leaflet-control-zoom { border: 0; margin-top: 12px !important; margin-left: 12px !important; }
        .henima-track-map .leaflet-control-zoom a { background:#101827; color:#F1F5F9; border-color:#243247; width: 32px; height: 32px; line-height: 32px; }
        .henima-track-map .leaflet-popup-content-wrapper, .henima-track-map .leaflet-popup-tip { background:#101827; color:#F1F5F9; }
        .henima-track-map .leaflet-container { background:#080D18; font-family: inherit; }
        .henima-track-map .leaflet-interactive { cursor: pointer; }
        .henima-track-map .leaflet-control-attribution { display: none !important; }
      `}</style>

      <aside className={`${navOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-[220px] flex-col border-r border-[#243247] bg-[#0B1220]/80 backdrop-blur-md md:static md:flex`}>
        <div className="px-4 pb-3 pt-5">
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#06D6D6]">HENIMA</p>
          <p className="text-sm font-bold">Tracking</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const className = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${item.active ? "bg-[#06D6D6]/12 text-[#06D6D6]" : "text-[#94A3B8] hover:bg-white/[0.04]"}`;
            if (item.href.startsWith("#")) {
              return (
                <a key={item.label} href={item.href} onClick={() => setNavOpen(false)} className={className}>
                  <Icon size={16} />
                  {item.label}
                </a>
              );
            }
            return (
              <Link key={item.label} href={item.href} className={className}>
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 flex items-center gap-2 rounded-xl border border-[#243247] px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
          <div>
            <p className="text-xs font-bold">GercepAI</p>
            <p className="text-[10px] font-medium text-[#94A3B8]">Henima Tracking</p>
          </div>
        </div>
      </aside>
      {navOpen && <button type="button" aria-label="Tutup menu" className="absolute inset-0 z-20 bg-black/50 md:hidden" onClick={() => setNavOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#243247]/80 bg-[#080D18]/35 px-3 py-2.5 backdrop-blur-md md:px-4">
          <button type="button" onClick={() => setNavOpen(true)} className="rounded-lg border border-[#243247] px-2 py-1.5 text-xs font-semibold md:hidden">
            Menu
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama sales, lokasi atau tanggal..."
            className="h-10 min-w-[180px] flex-1 rounded-xl border border-[#243247] bg-[#101827] px-3 text-sm font-medium outline-none placeholder:text-[#64748B]"
          />
          <DayCalendar date={date} today={today} marked={memory} onPick={openDay} />
          <span className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${date === today ? "border-[#22E6A8]/40 text-[#22E6A8]" : "border-[#243247] text-[#94A3B8]"}`}>
            <Wifi size={15} />
            <span className="leading-tight">
              {date === today ? "Live Tracking" : "Arsip"}
              <span className="block text-[10px] font-medium text-[#94A3B8]">{aktif} sales aktif</span>
            </span>
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#243247] bg-[#101827] text-[#94A3B8]" title="Belum ada notifikasi">
            <Bell size={16} />
          </span>
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#243247] bg-[#101827] px-2 pr-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#06D6D6] text-xs font-bold text-[#080D18]">{initials(ownerName)}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[120px] truncate text-xs font-bold">{ownerName}</span>
              <span className="block text-[10px] font-medium text-[#94A3B8]">Owner</span>
            </span>
          </span>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-3 px-3 pt-3 md:px-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Henima Tracking</h1>
            <p className="mt-0.5 text-sm font-medium text-[#94A3B8]">Pantau lokasi sales, rute perjalanan, dan foto check-in secara real-time.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat icon={<Users size={16} />} label="Total Sales" value={String(links.length)} hint="Orang" />
            <Stat icon={<span className="h-2.5 w-2.5 rounded-full bg-[#22E6A8]" />} label="Aktif" value={String(aktif)} hint="Sedang bekerja" tone="ok" />
            <Stat icon={<span className="text-sm font-bold text-[#FFD34D]">!</span>} label="Terlambat" value={String(late)} hint="Lewat 09:00" tone="late" />
            <Stat icon={<Camera size={16} />} label="Total Check-in" value={String(checkins)} hint={date === today ? "Hari ini" : longDate(date)} tone="photo" />
          </div>
        </div>

        <div id="riwayat" className="flex items-center gap-2 overflow-x-auto px-3 pt-2 md:px-4">
          <button type="button" onClick={() => openDay(shiftDay(date, -1))} className="shrink-0 rounded-full border border-[#243247] px-2.5 py-1 text-xs font-semibold text-[#94A3B8]">
            Sebelumnya
          </button>
          {date !== today && (
            <button type="button" onClick={() => openDay(today)} className="shrink-0 rounded-full border border-[#06D6D6]/40 px-2.5 py-1 text-xs font-semibold text-[#06D6D6]">
              Hari ini
            </button>
          )}
          {memory.slice(0, 8).map((ymd) => (
            <button
              key={ymd}
              type="button"
              onClick={() => openDay(ymd)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${ymd === date ? "border-[#FFD34D] text-[#FFD34D]" : "border-[#243247] text-[#94A3B8]"}`}
            >
              {ymd === today ? "Hari ini" : longDate(ymd).replace(/ \d{4}$/, "")}
            </button>
          ))}
        </div>
        {(notice || formError) && <p className="mx-3 mt-2 rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200 md:mx-4">{notice || formError}</p>}

        <div className="grid min-h-0 flex-1 gap-3 px-3 py-3 lg:grid-cols-[340px_1fr] md:px-4">
          <section className="flex max-h-[48vh] min-h-0 flex-col rounded-2xl border border-[#243247] bg-[#0B1220]/75 backdrop-blur-md lg:max-h-none">
            <div className="flex items-center justify-between px-3 pt-3">
              <p className="text-sm font-bold">Filter Sales</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFocus("all");
                }}
                className="text-xs font-semibold text-[#94A3B8]"
              >
                Reset
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
              <button
                type="button"
                onClick={() => setFocus("all")}
                className={`rounded-full px-3 py-1 text-xs font-bold ${focus === "all" ? "bg-[#22E6A8] text-[#080D18]" : "border border-[#243247] text-[#94A3B8]"}`}
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
                    color: focus === link.staffId ? "#080D18" : colorOf(link.staffId),
                    background: focus === link.staffId ? colorOf(link.staffId) : "transparent",
                  }}
                >
                  {link.nama}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs font-medium text-[#94A3B8]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama sales..."
                className="h-8 min-w-0 flex-1 rounded-lg border border-[#243247] bg-[#101827] px-2 text-xs font-medium text-[#F1F5F9] outline-none placeholder:text-[#64748B]"
              />
              <label className="inline-flex items-center gap-1">
                Urutkan
                <select value={sort} onChange={(event) => setSort(event.target.value as "nama" | "terakhir")} className="bg-transparent font-semibold text-[#F1F5F9] outline-none">
                  <option value="nama">Nama</option>
                  <option value="terakhir">Terakhir</option>
                </select>
              </label>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {people.length === 0 && <p className="rounded-xl border border-[#243247] bg-[#101827] p-3 text-sm text-[#94A3B8]">Tidak ada sales dengan nama itu.</p>}
              {people.map((link) => {
                const card = snapshot(link, points);
                return (
                  <article key={link.staffId} className="rounded-2xl border border-[#243247] bg-[#101827]/85 p-3">
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#080D18]" style={{ background: colorOf(link.staffId) }}>
                        {initials(link.nama)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-bold">{link.nama}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={card.status} />
                            <button type="button" onClick={() => setDetail(detail === link.staffId ? "" : link.staffId)} className="text-[11px] font-semibold text-[#06D6D6]">
                              {detail === link.staffId ? "Tutup" : "Lihat Detail"}
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                          {card.last ? `Sampai ${clock(card.last.recorded_at)} · ${card.visits.length} tempat` : "Belum ada titik"}
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#94A3B8]">Posisi terakhir</p>
                            <p className="truncate text-xs font-semibold">{card.last?.note || (card.last ? "Titik GPS tersimpan" : "Belum berangkat")}</p>
                            {card.last && <p className="text-[11px] font-medium text-[#94A3B8]">{ago(card.last.recorded_at)}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-semibold text-[#94A3B8]">Status</p>
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
                        className="rounded-xl bg-[#FFD34D] py-2 text-xs font-bold text-[#080D18]"
                      >
                        Lihat di Peta
                      </button>
                      <button type="button" onClick={() => void copy(link)} className="rounded-xl border border-[#243247] bg-[#0B1220] py-2 text-xs font-semibold text-[#F1F5F9]">
                        {copied === link.staffId ? "Tersalin" : "Salin Link HP"}
                      </button>
                    </div>
                    {detail === link.staffId && (
                      <div className="mt-3 border-t border-[#243247] pt-2 text-xs text-[#94A3B8]">
                        {link.status !== "active" ? (
                          <button type="button" onClick={() => void activate(link.staffId)} className="mb-2 w-full rounded-xl border border-[#243247] py-2 font-semibold text-[#F1F5F9]">
                            Aktifkan untuk check-in
                          </button>
                        ) : link.token ? (
                          <a href={link.path} target="_blank" rel="noreferrer" className="mb-2 block text-center font-semibold text-[#06D6D6]">
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
                          <button type="button" onClick={() => void remove(link)} className="mt-2 font-semibold text-red-300">
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
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addSales();
                }}
              >
                <input
                  value={nama}
                  onChange={(event) => setNama(event.target.value)}
                  placeholder="Nama sales baru"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-[#243247] bg-[#080D18] px-3 text-sm outline-none"
                />
                <button type="submit" disabled={adding || !nama.trim()} className="rounded-xl bg-[#FFD34D] px-3 text-xs font-bold text-[#080D18] disabled:opacity-40">
                  {adding ? "..." : "Tambah"}
                </button>
              </form>
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <div id="peta-tracking" className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-[#243247] bg-[#080D18]">
              <TrackingMap
                points={visible}
                colorOf={colorOf}
                nameOf={nameOf}
                focusStaffId={focus === "all" ? undefined : focus}
                focusPointId={focusPointId}
                onPoint={setViewer}
              />
              {visible.length === 0 && (
                <p className="pointer-events-none absolute left-1/2 top-16 z-[400] w-[min(280px,80%)] -translate-x-1/2 rounded-xl border border-[#243247] bg-[#101827]/95 px-3 py-2 text-center text-xs font-medium text-[#94A3B8]">
                  Belum ada jejak pada tanggal ini.
                </p>
              )}
            </div>
            <div id="foto-checkin">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">{date === today ? "Foto Check-in Hari Ini" : `Foto ${longDate(date)}`}</h2>
                <button type="button" onClick={() => setFocus("all")} className="text-xs font-semibold text-[#06D6D6]">
                  Lihat semua
                </button>
              </div>
              {photos.length === 0 ? (
                <p className="rounded-2xl border border-[#243247] bg-[#101827] px-3 py-3 text-sm text-[#94A3B8]">
                  {date === today ? "Foto muncul di sini setelah sales check-in atau mencatat tempat nawar." : "Tanggal ini belum ada foto."}
                </p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((point) => (
                    <li key={point.id} className="w-44 shrink-0 overflow-hidden rounded-2xl border border-[#243247] bg-[#101827]">
                      <button type="button" onClick={() => setViewer(point)} className="block w-full text-left">
                        <Thumb src={point.photo_url || ""} />
                      </button>
                      <div className="p-2">
                        <p className="truncate text-xs font-bold">{nameOf(point.staff_id)}</p>
                        <p className="text-[11px] font-medium text-[#94A3B8]">{clock(point.recorded_at)} · {KIND[point.kind]}</p>
                        <p className="truncate text-[11px] text-[#94A3B8]">{point.note || "Titik GPS"}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFocus(point.staff_id);
                            setFocusPointId(point.id);
                            document.getElementById("peta-tracking")?.scrollIntoView({ block: "nearest" });
                          }}
                          className="mt-1 text-[11px] font-semibold text-[#06D6D6]"
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
      {viewer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onClick={() => setViewer(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#243247] bg-[#101827] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            {viewer.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.photo_url} alt="" className="max-h-[70vh] w-full bg-black object-contain" />
            ) : (
              <p className="px-4 py-10 text-center text-sm text-[#94A3B8]">Titik ini belum ada foto.</p>
            )}
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold">{nameOf(viewer.staff_id)}</p>
                <p className="text-xs font-medium text-[#94A3B8]">{clock(viewer.recorded_at)} · {KIND[viewer.kind]}</p>
                <p className="mt-1 text-xs text-[#94A3B8]">{viewer.note || "Titik GPS tersimpan"}</p>
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
                  className="rounded-xl bg-[#FFD34D] px-3 py-2 text-xs font-bold text-[#080D18]"
                >
                  Lihat di peta
                </button>
                <button type="button" onClick={() => setViewer(null)} className="rounded-xl border border-[#243247] px-3 py-2 text-xs font-semibold">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
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
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));
  const markedSet = useMemo(() => new Set(marked), [marked]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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
          setOpen((value) => !value);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#243247] bg-[#101827] px-3 text-sm font-semibold"
      >
        <CalendarDays size={15} className="text-[#94A3B8]" />
        {longDate(date)}
        <ChevronDown size={14} className={`text-[#94A3B8] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[292px] rounded-2xl border border-[#243247] bg-[#101827] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#243247] text-[#F1F5F9]" aria-label="Bulan sebelumnya">
              ‹
            </button>
            <p className="text-sm font-bold capitalize">{title}</p>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => canNext && setMonth((value) => shiftMonth(value, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#243247] text-[#F1F5F9] disabled:opacity-30"
              aria-label="Bulan berikutnya"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#94A3B8]">
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
                      ? "bg-[#06D6D6] text-[#080D18]"
                      : isToday
                        ? "border border-[#FFD34D] text-[#FFD34D]"
                        : "text-[#F1F5F9] hover:bg-white/5"
                  } disabled:cursor-default disabled:text-[#475569] disabled:hover:bg-transparent`}
                >
                  {Number(ymd.slice(8))}
                  {markedSet.has(ymd) && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#FFD34D]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="flex h-[88px] items-center justify-center bg-[#080D18] text-[11px] text-[#94A3B8]">Foto tidak tampil</div>;
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
  const iconBg = tone === "ok" ? "bg-[#22E6A8]/15 text-[#22E6A8]" : tone === "late" ? "bg-[#FFD34D]/15 text-[#FFD34D]" : tone === "photo" ? "bg-[#fb7185]/15 text-[#fb7185]" : "bg-[#06D6D6]/10 text-[#06D6D6]";
  return (
    <div className="flex min-w-[148px] items-center gap-2.5 rounded-2xl border border-[#243247] bg-[#101827]/80 px-3 py-2 backdrop-blur-md">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>{icon}</span>
      <span>
        <span className="block text-[11px] font-semibold text-[#94A3B8]">{label}</span>
        <span className="block text-lg font-bold leading-5">{value} <span className="text-[11px] font-medium text-[#94A3B8]">{hint}</span></span>
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: { label: string; tone: "off" | "road" | "late" } }) {
  const cls =
    status.tone === "road"
      ? "bg-[#22E6A8]/15 text-[#22E6A8]"
      : status.tone === "late"
        ? "bg-[#FFD34D]/15 text-[#FFD34D]"
        : "bg-white/5 text-[#94A3B8]";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{status.label}</span>;
}
