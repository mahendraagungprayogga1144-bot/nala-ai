"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Download,
  MapPinned,
  Package,
  Search,
  ShoppingBag,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import {
  type DashboardPeriod,
  type OwnerDashboardSummary,
  pctChange,
} from "@/lib/henima-tracking/owner-dashboard";
import { downloadCommandCenterPdf } from "@/lib/henima-tracking/dashboard-pdf";
import type { TrackingLink, TrackingPoint } from "@/lib/henima-tracking/shared";

const GOLD = "#C5A358";

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous);
  if (!previous && !current) return <span className="text-xs text-[#8A8A8A]">vs periode lalu</span>;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "+" : "−"}
      {Math.abs(pct)}% vs periode lalu
    </span>
  );
}

export type LiveSalesCard = {
  staffId: string;
  nama: string;
  status: string;
  tone: "road" | "late" | "off";
  note?: string | null;
  recordedAt?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function TrackingHome({
  ownerName,
  summary: initialSummary,
  liveSales,
  activityPoints,
  onOpenLokasi,
  onFocusSales,
}: {
  ownerName: string;
  summary: OwnerDashboardSummary;
  liveSales: LiveSalesCard[];
  activityPoints: TrackingPoint[];
  links?: TrackingLink[];
  onOpenLokasi: () => void;
  onFocusSales?: (staffId: string) => void;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");
  const [summary, setSummary] = useState(initialSummary);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [chartMode, setChartMode] = useState<"7" | "30" | "90">("30");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  async function loadPeriod(next: DashboardPeriod) {
    if (next === period) return;
    setPeriod(next);
    setPeriodBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/henima-tracking/dashboard?period=${next}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat periode.");
      setSummary(json.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat periode.");
    } finally {
      setPeriodBusy(false);
    }
  }

  const series = useMemo(() => {
    if (chartMode === "7") {
      return summary.chartDaily.slice(-7).map((r) => ({
        label: r.label,
        value: r.omzet,
        target: r.target,
      }));
    }
    if (chartMode === "90") {
      return summary.chartMonthly.map((r) => ({ label: r.label, value: r.omzet, target: r.target }));
    }
    return summary.chartDaily.slice(-30).map((r) => ({
      label: r.label,
      value: r.omzet,
      target: r.target,
    }));
  }, [chartMode, summary]);

  const online = liveSales.filter((s) => s.tone === "road").length;
  const aktif = liveSales.filter((s) => s.tone !== "off").length;
  const totalSales = liveSales.length;
  const q = query.trim().toLowerCase();

  const ranking = useMemo(() => {
    const rows = summary.ranking;
    if (!q) return rows;
    return rows.filter((r) => r.nama.toLowerCase().includes(q));
  }, [summary.ranking, q]);

  const recentSales = useMemo(() => {
    const rows = summary.recentSales;
    if (!q) return rows;
    return rows.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        o.salesName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q),
    );
  }, [summary.recentSales, q]);

  const filteredLive = useMemo(() => {
    if (!q) return liveSales;
    return liveSales.filter((s) => s.nama.toLowerCase().includes(q));
  }, [liveSales, q]);

  const activities = useMemo(() => {
    const fromGps = activityPoints
      .filter((p) => p.kind !== "ping" || !p.note)
      .slice(0, 12)
      .map((p) => {
        const sales = liveSales.find((s) => s.staffId === p.staff_id)?.nama || "Sales";
        const kindLabel =
          p.kind === "checkin_pagi"
            ? "check-in"
            : p.kind === "checkin_sore"
              ? "selesai kerja"
              : p.kind === "visit"
                ? "kunjungan"
                : p.kind === "qris"
                  ? "QRIS"
                  : "update lokasi";
        return {
          id: `gps-${p.id}`,
          at: p.recorded_at,
          text: `${sales} ${kindLabel}${p.note ? ` · ${p.note}` : ""}`,
        };
      });
    const fromSales = summary.recentSales.slice(0, 6).map((o) => ({
      id: `sale-${o.id}`,
      at: o.createdAt,
      text: `${o.salesName} catat penjualan ${o.productName} · ${rp(o.total)}`,
    }));
    const fromRank = summary.ranking
      .filter((r) => r.pct >= 80)
      .slice(0, 3)
      .map((r) => ({
        id: `rank-${r.salesId}`,
        at: new Date().toISOString(),
        text: `${r.nama} mencapai target bulanan ${Math.round(r.pct)}%`,
      }));
    return [...fromGps, ...fromSales, ...fromRank]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);
  }, [activityPoints, liveSales, summary.ranking, summary.recentSales]);

  const featured = filteredLive.find((s) => s.tone === "road") || filteredLive[0];

  async function exportPdf() {
    setPdfBusy(true);
    setError("");
    try {
      await downloadCommandCenterPdf({
        ownerName,
        periodLabel: summary.monthLabel,
        summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari sales, transaksi, atau pelanggan…"
            className="w-full rounded-xl border border-[#E8E8E4] bg-white py-2.5 pl-9 pr-3 text-sm text-[#111] outline-none focus:border-[#C5A358]"
          />
        </label>
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-sm font-semibold text-[#111]">
          <CalendarDays size={15} style={{ color: GOLD }} />
          <select
            value={period}
            disabled={periodBusy}
            onChange={(e) => void loadPeriod(e.target.value as DashboardPeriod)}
            className="bg-transparent text-sm font-semibold outline-none disabled:opacity-50"
            aria-label="Pilih bulan"
          >
            <option value="this_month">Bulan ini</option>
            <option value="last_month">Bulan lalu</option>
          </select>
        </div>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void exportPdf()}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: GOLD }}
        >
          <Download size={15} />
          {pdfBusy ? "Menyusun PDF…" : "Unduh PDF"}
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-[#E8D9A8] bg-[#F7F4EC]">
        <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(200px,0.8fr)] md:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
              HENIMA Sales
            </p>
            <h1 className="mt-2 text-[26px] font-bold tracking-tight text-[#111] md:text-[32px]">
              Selamat datang, {ownerName}
            </h1>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Grow Together, Achieve More · rekap {summary.monthLabel}
              {periodBusy ? " · memuat…" : ""}
            </p>
          </div>
          <div className="relative mx-auto h-28 w-full max-w-[220px] md:mx-0 md:justify-self-end">
            <Image
              src="/henima-cyber-city.jpg"
              alt=""
              fill
              className="rounded-xl object-cover"
              sizes="220px"
              priority={false}
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-[#F7F4EC]/70 to-transparent" />
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          icon={Wallet}
          label="Omzet bulan ini"
          value={rp(summary.omzetBulan)}
          footer={<Delta current={summary.omzetBulan} previous={summary.omzetBulanLalu} />}
        />
        <Metric
          icon={Package}
          label="Produk terjual"
          value={`${summary.botolBulan} pcs`}
          footer={<Delta current={summary.botolBulan} previous={summary.botolBulanLalu} />}
        />
        <Metric
          icon={ShoppingBag}
          label="Total transaksi"
          value={`${summary.transaksiBulan}`}
          footer={<Delta current={summary.transaksiBulan} previous={summary.transaksiBulanLalu} />}
        />
        <Metric
          icon={Users}
          label="Sales aktif"
          value={`${aktif} dari ${totalSales || aktif}`}
          footer={
            <span className="text-xs font-semibold text-[#6B6B6B]">
              Online: <span style={{ color: GOLD }}>{online}</span>
            </span>
          }
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#111]">Performa penjualan</h2>
              <p className="text-xs text-[#8A8A8A]">Omzet vs target · {summary.monthLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border border-[#E8E8E4] text-xs font-semibold">
                {(
                  [
                    ["7", "7 Hari"],
                    ["30", "30 Hari"],
                    ["90", "90 Hari"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChartMode(id)}
                    className={`px-3 py-1.5 ${chartMode === id ? "bg-[#111] text-white" : "bg-white text-[#6B6B6B]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void exportPdf()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E8E4] text-[#6B6B6B] hover:text-[#111]"
                title="Unduh PDF rekap"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          <SalesChart points={series} />
        </div>

        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#111]">Live GPS</h2>
              <p className="text-xs text-[#8A8A8A]">Posisi sales lapangan hari ini</p>
            </div>
            <button type="button" onClick={onOpenLokasi} className="text-xs font-semibold" style={{ color: GOLD }}>
              Lihat semua lokasi
            </button>
          </div>
          <div className="relative min-h-[200px] overflow-hidden rounded-xl border border-[#E8E8E4] bg-[#FAFAF8]">
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "linear-gradient(#E8E8E4 1px, transparent 1px), linear-gradient(90deg, #E8E8E4 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="relative flex flex-wrap content-center gap-3 p-4">
              {filteredLive.slice(0, 8).map((s) => (
                <button
                  key={s.staffId}
                  type="button"
                  onClick={() => {
                    onFocusSales?.(s.staffId);
                    onOpenLokasi();
                  }}
                  className="flex items-center gap-2 rounded-full border border-white bg-white/95 px-2 py-1.5 shadow-sm"
                  title={s.note || s.status}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: s.tone === "road" ? GOLD : s.tone === "late" ? "#B45309" : "#9CA3AF" }}
                  >
                    {initials(s.nama)}
                  </span>
                  <span className="pr-1 text-left">
                    <span className="block max-w-[88px] truncate text-[11px] font-bold text-[#111]">{s.nama}</span>
                    <span
                      className={`block text-[10px] font-semibold ${
                        s.tone === "road" ? "text-emerald-600" : s.tone === "late" ? "text-amber-700" : "text-[#8A8A8A]"
                      }`}
                    >
                      {s.status}
                    </span>
                  </span>
                </button>
              ))}
              {!filteredLive.length && (
                <p className="text-sm text-[#6B6B6B]">Belum ada sales terhubung. Tambah di Pengaturan.</p>
              )}
            </div>
          </div>
          {featured ? (
            <div className="mt-3 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <MapPinned size={14} style={{ color: GOLD }} />
                <p className="text-sm font-bold text-[#111]">{featured.nama}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    featured.tone === "road"
                      ? "bg-emerald-50 text-emerald-700"
                      : featured.tone === "late"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-[#F3F3F1] text-[#6B6B6B]"
                  }`}
                >
                  {featured.status}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-[#6B6B6B]">
                {featured.note || "Lokasi terakhir dari app sales"}
                {featured.recordedAt ? ` · ${clock(featured.recordedAt)}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#111]">Peringkat sales</h2>
            <select
              value={period}
              disabled={periodBusy}
              onChange={(e) => void loadPeriod(e.target.value as DashboardPeriod)}
              className="rounded-lg border border-[#E8E8E4] bg-[#FAFAF8] px-2 py-1 text-xs font-semibold text-[#111]"
            >
              <option value="this_month">Bulan ini</option>
              <option value="last_month">Bulan lalu</option>
            </select>
          </div>
          <ul className="space-y-3">
            {ranking.slice(0, 5).map((row, i) => (
              <li key={row.salesId} className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: i === 0 ? GOLD : "#111" }}
                >
                  {initials(row.nama)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-bold text-[#111]">{row.nama}</p>
                    <p className="shrink-0 text-xs font-bold tabular-nums text-[#111]">{rp(row.omzet)}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8A8A8A]">{row.qty} produk</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EFEFEA]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, row.pct)}%`, background: GOLD }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[#6B6B6B]">{Math.round(row.pct)}%</span>
                  </div>
                </div>
              </li>
            ))}
            {!ranking.length && (
              <p className="text-sm text-[#6B6B6B]">Belum ada penjualan lunas di {summary.monthLabel}.</p>
            )}
          </ul>
          <Link href="/dashboard/sales/targets" className="mt-3 inline-block text-xs font-semibold" style={{ color: GOLD }}>
            Target & komisi
          </Link>
        </div>

        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111]">Transaksi terbaru</h2>
            <Link
              href="/dashboard/sales/orders"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#6B6B6B]"
            >
              Semua <ChevronRight size={12} />
            </Link>
          </div>
          <ul className="space-y-2.5">
            {recentSales.slice(0, 6).map((order) => (
              <li key={order.id} className="flex items-center gap-3 rounded-xl border border-[#F0F0EC] px-2.5 py-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7F4EC] text-[10px] font-bold"
                  style={{ color: GOLD }}
                >
                  {initials(order.customerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#111]">{order.customerName}</p>
                  <p className="truncate text-[11px] text-[#6B6B6B]">
                    {order.productName} · {order.salesName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold tabular-nums text-[#111]">{rp(order.total)}</p>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      order.status === "PAID"
                        ? "bg-emerald-50 text-emerald-700"
                        : order.status === "PENDING"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-[#F3F3F1] text-[#6B6B6B]"
                    }`}
                  >
                    {order.status === "PAID" ? "Paid" : order.status === "PENDING" ? "Pending" : order.status}
                  </span>
                </div>
              </li>
            ))}
            {!recentSales.length && <p className="text-sm text-[#6B6B6B]">Belum ada transaksi dari app sales.</p>}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111]">Aktivitas terbaru</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Live</span>
          </div>
          <ul className="space-y-3">
            {activities.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: GOLD }} />
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-[#111]">{item.text}</p>
                  <p className="mt-0.5 text-[11px] text-[#8A8A8A]">{clock(item.at)}</p>
                </div>
              </li>
            ))}
            {!activities.length && (
              <p className="text-sm text-[#6B6B6B]">Belum ada jejak GPS atau penjualan hari ini.</p>
            )}
          </ul>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2">
            <Target size={14} style={{ color: GOLD }} />
            <p className="text-xs text-[#6B6B6B]">
              Target bulan:{" "}
              <span className="font-bold text-[#111]">
                {summary.targetRevenue > 0
                  ? rp(summary.targetRevenue)
                  : summary.targetQty > 0
                    ? `${summary.targetQty} botol`
                    : "belum di-set"}
              </span>
              {" · "}
              <span className="font-semibold" style={{ color: GOLD }}>
                {Math.round(summary.pencapaianPct)}%
              </span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  footer,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  footer: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F4EC]">
          <Icon size={15} color={GOLD} />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-[#111]">{value}</p>
      <div className="mt-2">{footer}</div>
    </div>
  );
}

function SalesChart({ points }: { points: { label: string; value: number; target?: number }[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.value, p.target || 0)));
  const w = 560;
  const h = 220;
  const padX = 28;
  const padY = 24;
  const coords = points.map((p, i) => {
    const x = padX + (i * (w - padX * 2)) / Math.max(1, points.length - 1);
    const y = h - padY - (p.value / max) * (h - padY * 2);
    const ty = p.target != null ? h - padY - (p.target / max) * (h - padY * 2) : null;
    return { ...p, x, y, ty };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]?.x || padX},${h - padY} L${padX},${h - padY} Z`;
  const targetLine = coords
    .filter((c) => c.ty != null)
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.ty}`)
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full min-w-[320px]">
        {[0, 0.33, 0.66, 1].map((t) => {
          const y = h - padY - t * (h - padY * 2);
          const label = t === 0 ? "0" : t === 1 ? formatAxis(max) : "";
          return (
            <g key={t}>
              <line x1={padX} x2={w - padX} y1={y} y2={y} stroke="#EFEFEA" strokeWidth="1" />
              {label ? (
                <text x={4} y={y + 4} fontSize="10" fill="#8A8A8A">
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
        {targetLine ? (
          <path d={targetLine} fill="none" stroke="#C9C4B8" strokeWidth="1.5" strokeDasharray="5 4" />
        ) : null}
        <path d={area} fill="url(#henimaGoldFill)" opacity="0.35" />
        <path d={line} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) =>
          i % Math.ceil(coords.length / 8) === 0 || i === coords.length - 1 ? (
            <g key={c.label + c.x}>
              <circle cx={c.x} cy={c.y} r="3.5" fill="#fff" stroke={GOLD} strokeWidth="2" />
              <text x={c.x} y={h - 6} textAnchor="middle" fontSize="10" fill="#8A8A8A">
                {c.label}
              </text>
            </g>
          ) : null,
        )}
        <defs>
          <linearGradient id="henimaGoldFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.45" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-1 flex gap-4 text-[10px] font-semibold text-[#8A8A8A]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: GOLD }} /> Omzet
        </span>
        {points.some((p) => p.target) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-[#C9C4B8]" /> Target
          </span>
        ) : null}
      </div>
      {!points.some((p) => p.value > 0) && (
        <p className="-mt-2 text-center text-xs text-[#8A8A8A]">Belum ada omzet pada periode ini.</p>
      )}
    </div>
  );
}

function formatAxis(n: number) {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10} jt`;
  if (n >= 1000) return `${Math.round(n / 100) / 10} rb`;
  return String(n);
}
