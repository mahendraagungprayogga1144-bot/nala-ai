"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type TrackingLink, type TrackingPoint } from "@/lib/henima-tracking/shared";
import TrackingMap, { staffColor } from "./tracking-map";

const KIND: Record<TrackingPoint["kind"], string> = {
  checkin_pagi: "Check-in",
  checkin_sore: "Check-out",
  visit: "Nawar",
  ping: "Jejak",
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

function dayLabel(ymd: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${ymd}T12:00:00+07:00`),
  );
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
  const status = !pagi
    ? { label: "Belum berangkat", tone: "off" as const }
    : sore
      ? { label: "Pulang", tone: "off" as const }
      : pagi.late
        ? { label: "Terlambat", tone: "late" as const }
        : { label: "Di jalan", tone: "road" as const };
  return { mine, pagi, sore, visits, last, status };
}

export default function TrackingDesk({
  date,
  today,
  days,
  links,
  points,
  notice,
}: {
  date: string;
  today: string;
  days: string[];
  links: TrackingLink[];
  points: TrackingPoint[];
  notice?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState("");
  const [focus, setFocus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState("");
  const [nama, setNama] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

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
  const people = links.filter((link) => {
    if (!needle) return true;
    const last = points.find((point) => point.staff_id === link.staffId);
    return link.nama.toLowerCase().includes(needle) || (last?.note || "").toLowerCase().includes(needle);
  });
  const visible = (focus === "all" ? points : points.filter((point) => point.staff_id === focus)).filter((point) =>
    people.some((link) => link.staffId === point.staff_id),
  );
  const photos = visible.filter((point) => point.photo_url);
  const fieldLinks = links.filter((link) => link.role !== "FOUNDER");
  const onRoad = fieldLinks.filter((link) => snapshot(link, points).status.tone === "road").length;
  const late = fieldLinks.filter((link) => snapshot(link, points).status.tone === "late").length;
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
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden text-[#F1F5F9]">
      <style>{`
        .henima-track-map .leaflet-control-zoom a { background:#101827; color:#F1F5F9; border-color:#243247; }
        .henima-track-map .leaflet-popup-content-wrapper, .henima-track-map .leaflet-popup-tip { background:#101827; color:#F1F5F9; }
        .henima-track-map .leaflet-container { background:#080D18; font-family:inherit; }
      `}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Henima Tracking</h2>
          <p className="mt-1 text-sm font-medium text-[#94A3B8]">Pantau lokasi sales, rute perjalanan, dan foto check-in secara real-time.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total sales" value={String(fieldLinks.length)} hint="orang" />
          <Stat label="Di jalan" value={String(onRoad)} hint="masih muter" tone="ok" />
          <Stat label="Terlambat" value={String(late)} hint="lewat 09:00" tone="late" />
          <Stat label="Check-in" value={String(checkins)} hint={date === today ? "hari ini" : dayLabel(date)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama sales atau catatan tempat"
          className="h-10 min-w-[220px] flex-1 rounded-xl border border-[#243247] bg-[#101827] px-3 text-sm font-medium outline-none placeholder:text-[#94A3B8]"
        />
        <button type="button" onClick={() => openDay(shiftDay(date, -1))} className="h-10 rounded-xl border border-[#243247] bg-[#101827] px-3 text-sm font-semibold text-[#94A3B8]">
          Sebelumnya
        </button>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(event) => event.target.value && openDay(event.target.value)}
          className="h-10 rounded-xl border border-[#243247] bg-[#101827] px-3 text-sm font-semibold"
        />
        {date !== today && (
          <button type="button" onClick={() => openDay(today)} className="h-10 rounded-xl border border-[#06D6D6]/40 px-3 text-sm font-semibold text-[#06D6D6]">
            Hari ini
          </button>
        )}
        <span className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${date === today ? "border-[#22E6A8]/30 text-[#22E6A8]" : "border-[#243247] text-[#94A3B8]"}`}>
          <span className={`h-2 w-2 rounded-full ${date === today ? "bg-[#22E6A8]" : "bg-[#94A3B8]"}`} />
          {date === today ? "Live tracking" : "Arsip"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {memory.slice(0, 10).map((ymd) => (
          <button
            key={ymd}
            type="button"
            onClick={() => openDay(ymd)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ymd === date ? "border-[#FFD34D] text-[#FFD34D]" : "border-[#243247] text-[#94A3B8]"}`}
          >
            {ymd === today ? "Hari ini" : dayLabel(ymd)}
          </button>
        ))}
      </div>
      {notice && <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{notice}</p>}
      {formError && <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{formError}</p>}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_1fr]">
        <aside className="flex max-h-[46vh] min-h-0 flex-col gap-2 overflow-hidden lg:max-h-none">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <FilterChip active={focus === "all"} onClick={() => setFocus("all")} label="Semua" />
            {people.map((link) => (
              <FilterChip key={link.staffId} active={focus === link.staffId} onClick={() => setFocus(link.staffId)} label={link.nama} color={colorOf(link.staffId)} />
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {people.length === 0 && <p className="rounded-2xl border border-[#243247] bg-[#101827] p-4 text-sm text-[#94A3B8]">Tidak ada sales dengan nama itu.</p>}
            {people.map((link) => {
              const card = snapshot(link, points);
              return (
                <article key={link.staffId} className="rounded-2xl border border-[#243247] bg-[#101827] p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#080D18]" style={{ background: colorOf(link.staffId) }}>
                      {initials(link.nama)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">{link.nama}</p>
                        <StatusBadge status={card.status} />
                      </div>
                      <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                        {card.last ? `Terakhir ${clock(card.last.recorded_at)} · ${KIND[card.last.kind]}` : "Belum ada titik"}
                        {` · ${card.visits.length} tempat`}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">
                        {card.last?.note || (card.last ? "Titik GPS tersimpan" : link.terhubung ? "Akun siap, belum berangkat" : "Belum masuk lewat link HP")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFocus(link.staffId)} className="rounded-xl bg-[#06D6D6] py-2 text-xs font-bold text-[#080D18]">
                      Lihat di peta
                    </button>
                    <button type="button" onClick={() => void copy(link)} className="rounded-xl border border-[#243247] py-2 text-xs font-semibold text-[#FFD34D]">
                      {copied === link.staffId ? "Tersalin" : "Salin link HP"}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                    <button type="button" onClick={() => setDetail(detail === link.staffId ? "" : link.staffId)} className="text-[#94A3B8]">
                      {detail === link.staffId ? "Tutup detail" : "Lihat detail"}
                    </button>
                    {link.role !== "FOUNDER" && (
                      <button type="button" onClick={() => void remove(link)} className="text-red-300">
                        Hapus
                      </button>
                    )}
                  </div>
                  {link.status !== "active" && (
                    <button type="button" onClick={() => void activate(link.staffId)} className="mt-2 w-full rounded-xl border border-[#243247] py-2 text-xs font-semibold">
                      Aktifkan untuk check-in
                    </button>
                  )}
                  {detail === link.staffId && (
                    <ul className="mt-3 space-y-1 border-t border-[#243247] pt-2 text-xs text-[#94A3B8]">
                      {card.mine.filter((point) => point.kind !== "ping").length === 0 && <li>Belum ada check-in atau tempat nawar.</li>}
                      {card.mine
                        .filter((point) => point.kind !== "ping")
                        .map((point) => (
                          <li key={point.id} className="flex justify-between gap-2">
                            <span>{KIND[point.kind]}{point.note ? ` · ${point.note}` : ""}</span>
                            <span>{clock(point.recorded_at)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </article>
              );
            })}
            <form
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
        </aside>

        <section className="flex min-h-0 flex-col gap-3">
          <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-[#243247] bg-[#080D18]">
            <TrackingMap points={visible} colorOf={colorOf} nameOf={nameOf} focusStaffId={focus === "all" ? undefined : focus} />
            <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-[#243247] bg-[#101827]/95 px-3 py-2 text-[11px] font-medium text-[#94A3B8]">
              <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#22E6A8]" />Posisi terbaru</p>
              <p className="mt-1"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#FFD34D]" />Tempat nawar</p>
              <p className="mt-1">Garis warna = rute orang itu</p>
            </div>
            {visible.length === 0 && (
              <p className="pointer-events-none absolute left-1/2 top-4 z-[400] -translate-x-1/2 rounded-xl border border-[#243247] bg-[#101827]/95 px-3 py-2 text-center text-xs font-medium text-[#94A3B8]">
                Belum ada jejak pada tanggal ini.
              </p>
            )}
          </div>

          <div id="foto-checkin" className="shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">Foto check-in hari ini</h3>
              <span className="text-xs font-medium text-[#94A3B8]">{photos.length} foto</span>
            </div>
            {photos.length === 0 ? (
              <p className="rounded-2xl border border-[#243247] bg-[#101827] px-3 py-4 text-sm text-[#94A3B8]">
                {date === today ? "Foto muncul di sini setelah sales check-in atau mencatat tempat nawar." : "Tanggal ini belum ada foto."}
              </p>
            ) : (
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((point) => (
                  <li key={point.id} className="w-40 shrink-0 overflow-hidden rounded-2xl border border-[#243247] bg-[#101827]">
                    {point.photo_url ? (
                      <img src={point.photo_url} alt="" className="h-24 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center text-xs text-[#94A3B8]">Foto gagal dimuat</div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-bold">{nameOf(point.staff_id)}</p>
                      <p className="text-[11px] font-medium text-[#94A3B8]">{clock(point.recorded_at)} · {KIND[point.kind]}</p>
                      <p className="truncate text-[11px] text-[#94A3B8]">{point.note || "Titik GPS"}</p>
                      <button type="button" onClick={() => setFocus(point.staff_id)} className="mt-1 text-[11px] font-semibold text-[#06D6D6]">
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
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "late" }) {
  const color = tone === "ok" ? "text-[#22E6A8]" : tone === "late" ? "text-[#FFD34D]" : "text-[#F1F5F9]";
  return (
    <div className="min-w-[120px] rounded-2xl border border-[#243247] bg-[#101827] px-3 py-2">
      <p className="text-[11px] font-semibold text-[#94A3B8]">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[11px] font-medium text-[#94A3B8]">{hint}</p>
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

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ borderColor: active ? color || "#06D6D6" : "#243247", color: active ? color || "#06D6D6" : "#94A3B8" }}
    >
      {label}
    </button>
  );
}
