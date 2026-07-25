"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, FileSpreadsheet,
  Lightbulb, AlertTriangle, CheckCircle2, Info, FileText,
} from "lucide-react";
import type { AnalitikKpi, DailyPoint, MonthlyPoint, PlRow, BizSlice, AnalitikInsight, AnalitikTxDetail } from "./page";
import { buildAnalitikPdfHtml } from "./lib/pdf-report";

const InventoryPrintPreview = dynamic(
  () => import("@/app/dashboard/inventory/components/inventory-print-preview"),
  { ssr: false },
);

const fmtRpSigned = (n: number) => {
  const s = "Rp" + Math.round(Math.abs(n)).toLocaleString("id-ID");
  if (n < 0) return `(${s})`;
  return s;
};
const fmtShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(Math.round(n));
};

const PIE_COLORS = ["#2DD4BF", "#818CF8", "#F59E0B", "#EC4899", "#34D399", "#60A5FA", "#F472B6", "#A78BFA"];

const TOOLTIP = {
  background: "#0A0A12",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
} as const;

function Delta({ pct, invert }: { pct: number; invert?: boolean }) {
  const good = invert ? pct <= 0 : pct >= 0;
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-[#8B8AA0]">
        <Minus size={10} /> 0%
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
        good ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {pct > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

type CatRow = { name: string; amount: number; amountPrev: number; share: number };

const INSIGHT_STYLE: Record<
  AnalitikInsight["tone"],
  { border: string; bg: string; icon: typeof Lightbulb; iconColor: string }
> = {
  good: { border: "border-emerald-500/30", bg: "bg-emerald-500/10", icon: CheckCircle2, iconColor: "text-emerald-400" },
  warn: { border: "border-amber-500/30", bg: "bg-amber-500/10", icon: AlertTriangle, iconColor: "text-amber-400" },
  bad: { border: "border-rose-500/30", bg: "bg-rose-500/10", icon: AlertTriangle, iconColor: "text-rose-400" },
  info: { border: "border-sky-500/25", bg: "bg-sky-500/10", icon: Info, iconColor: "text-sky-400" },
};

export default function AnalitikClient({
  kpi,
  daily,
  monthly,
  plRows,
  byCategory,
  byIncome,
  byBusiness,
  insights,
  recentTx,
  businesses,
  selectedBiz,
  selectedMonth,
  monthLabel,
  prevMonthLabel,
  monthOptions,
  ownerName,
  reportAddress,
  reportNo,
  businessLabel,
  deltas,
}: {
  kpi: AnalitikKpi;
  daily: DailyPoint[];
  monthly: MonthlyPoint[];
  plRows: PlRow[];
  byCategory: CatRow[];
  byIncome: CatRow[];
  byBusiness: BizSlice[];
  insights: AnalitikInsight[];
  recentTx: AnalitikTxDetail[];
  businesses: { id: string; name: string; type: string | null }[];
  selectedBiz: string;
  selectedMonth: string;
  monthLabel: string;
  prevMonthLabel: string;
  monthOptions: { value: string; label: string }[];
  ownerName: string;
  reportAddress: string;
  reportNo: string;
  businessLabel: string;
  deltas: { omzet: number; beban: number; laba: number; order: number };
}) {
  const router = useRouter();
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string | null>(null);
  const navigate = (biz: string, bulan: string) => {
    const q = new URLSearchParams();
    if (biz !== "all") q.set("biz", biz);
    q.set("bulan", bulan);
    router.push(`/dashboard/analitik?${q.toString()}`);
  };

  const hasData = kpi.omzet > 0 || kpi.beban > 0;
  const bizName = businessLabel;

  const kpiStrip = [
    {
      label: "Penjualan / Omzet",
      value: fmtRpSigned(kpi.omzet),
      sub: `vs ${prevMonthLabel}`,
      delta: <Delta pct={deltas.omzet} />,
      prev: fmtRpSigned(kpi.omzetPrev),
    },
    {
      label: "Beban Operasional",
      value: fmtRpSigned(kpi.beban),
      sub: `vs ${prevMonthLabel}`,
      delta: <Delta pct={deltas.beban} invert />,
      prev: fmtRpSigned(kpi.bebanPrev),
    },
    {
      label: kpi.laba >= 0 ? "Laba Bersih" : "Rugi Bersih",
      value: fmtRpSigned(kpi.laba),
      sub: `margin ${kpi.margin}%`,
      delta: <Delta pct={deltas.laba} />,
      prev: fmtRpSigned(kpi.labaPrev),
      accent: kpi.laba >= 0 ? "text-emerald-400" : "text-rose-400",
    },
    {
      label: "Margin Laba",
      value: `${kpi.margin}%`,
      sub: `bulan lalu ${kpi.marginPrev}%`,
      delta: <Delta pct={kpi.margin - kpi.marginPrev} />,
      prev: `${kpi.marginPrev}%`,
    },
    {
      label: "Jumlah Order",
      value: String(kpi.orderCount),
      sub: `rata-rata ${fmtRpSigned(kpi.avgOrder)}`,
      delta: <Delta pct={deltas.order} />,
      prev: String(kpi.orderCountPrev),
    },
    {
      label: "Transaksi Tercatat",
      value: String(kpi.txCount),
      sub: `bulan lalu ${kpi.txCountPrev}`,
      delta: <Delta pct={kpi.txCountPrev === 0 ? (kpi.txCount > 0 ? 100 : 0) : Math.round(((kpi.txCount - kpi.txCountPrev) / kpi.txCountPrev) * 100)} />,
      prev: String(kpi.txCountPrev),
    },
  ];

  const pieData = byCategory.filter((c) => c.amount > 0).map((c) => ({ name: c.name, value: c.amount }));

  const openPdfReport = () => {
    setPdfPreviewHtml(
      buildAnalitikPdfHtml({
        businessLabel: bizName,
        ownerName,
        reportAddress,
        reportNo,
        monthLabel,
        previousMonthLabel: prevMonthLabel,
        kpi,
        insights,
        plRows,
        daily,
        monthly,
        categories: byCategory,
        incomes: byIncome,
        businesses: byBusiness,
        recentTx,
      }),
    );
  };

  return (
    <div className="min-h-full bg-[#0A0A12]">
      {/* Accurate-style toolbar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0A12]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A5F]/40 text-[#7CB3E8]">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-white">Dashboard Analitik</h1>
              <p className="text-[11px] text-[#8B8AA0]">
                {bizName} · Periode {monthLabel} · dibandingkan {prevMonthLabel}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openPdfReport}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#7CB3E8]/30 bg-[#1E3A5F]/30 px-2.5 py-1.5 text-xs font-medium text-[#9CC8EE] hover:border-[#7CB3E8]/55 hover:bg-[#1E3A5F]/50"
              title="Unduh laporan PDF formal"
            >
              <FileText size={13} />
              Unduh PDF
            </button>
            <label className="text-[11px] text-[#8B8AA0]">Bisnis</label>
            <select
              value={selectedBiz}
              onChange={(e) => navigate(e.target.value, selectedMonth)}
              className="rounded-md border border-white/15 bg-[#12121C] px-2.5 py-1.5 text-xs text-white/90 outline-none focus:border-[#7CB3E8]/50"
            >
              <option value="all">Semua bisnis</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <label className="ml-1 text-[11px] text-[#8B8AA0]">Periode</label>
            <select
              value={selectedMonth}
              onChange={(e) => navigate(selectedBiz, e.target.value)}
              className="rounded-md border border-white/15 bg-[#12121C] px-2.5 py-1.5 text-xs text-white/90 outline-none focus:border-[#7CB3E8]/50"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
        {/* Auto insights — yang bikin owner langsung ngerti */}
        {insights.length > 0 && (
          <section className="rounded-xl border border-white/10 bg-[#0F0F1A] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-300" />
                <div>
                  <h2 className="text-sm font-semibold text-white">Insight otomatis</h2>
                  <p className="text-[11px] text-[#8B8AA0]">
                    Dibaca dari Keuangan Bisnis + Kasir F&amp;B + AI Kasir · {monthLabel}
                  </p>
                </div>
              </div>
              {kpi.retailOmzet > 0 && (
                <span className="rounded-md bg-teal-500/10 px-2 py-1 text-[10px] font-medium text-teal-300">
                  AI Kasir {fmtRpSigned(kpi.retailOmzet)} ikut terhitung
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {insights.map((ins) => {
                const st = INSIGHT_STYLE[ins.tone];
                const Icon = st.icon;
                return (
                  <div
                    key={ins.title + ins.body.slice(0, 24)}
                    className={`rounded-lg border ${st.border} ${st.bg} px-3 py-2.5`}
                  >
                    <div className="mb-1 flex items-start gap-2">
                      <Icon size={14} className={`mt-0.5 shrink-0 ${st.iconColor}`} />
                      <p className="text-[12px] font-semibold leading-snug text-white">{ins.title}</p>
                    </div>
                    <p className="pl-[22px] text-[11px] leading-relaxed text-[#B0AFC2]">{ins.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* KPI strip — Accurate density */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3 xl:grid-cols-6">
          {kpiStrip.map((k) => (
            <div key={k.label} className="bg-[#0F0F1A] px-3.5 py-3.5">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#8B8AA0]">
                {k.label}
              </p>
              <p className={`font-mono text-[17px] font-semibold leading-none ${k.accent || "text-white"}`}>
                {k.value}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                {k.delta}
                <span className="truncate text-[10px] text-[#8B8AA0]/80">{k.sub}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-[#8B8AA0]/60">lalu: {k.prev}</p>
            </div>
          ))}
        </div>

        {!hasData && (
          <div className="rounded-xl border border-dashed border-white/15 bg-[#0F0F1A] px-5 py-8 text-center text-sm text-[#8B8AA0]">
            Belum ada transaksi di periode ini. Catat lewat Keuangan Bisnis, Kasir F&amp;B, atau modul penjualan —
            laporan ini terisi otomatis.
          </div>
        )}

        {/* Main: Laba Rugi + Tren */}
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          {/* Laporan Laba Rugi — Accurate statement */}
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0F0F1A]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Laporan Laba Rugi</h2>
                <p className="text-[11px] text-[#8B8AA0]">
                  Periode {monthLabel} dibanding {prevMonthLabel}
                </p>
              </div>
              <span className="rounded bg-[#1E3A5F]/50 px-2 py-0.5 text-[10px] font-medium text-[#7CB3E8]">
                Ringkasan
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wide text-[#8B8AA0]">
                    <th className="px-4 py-2.5 font-medium">Akun / Kategori</th>
                    <th className="px-3 py-2.5 text-right font-medium">{monthLabel.split(" ")[0]}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{prevMonthLabel}</th>
                    <th className="px-3 py-2.5 text-right font-medium">Selisih</th>
                    <th className="px-4 py-2.5 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {plRows.map((row, i) => {
                    if (row.kind === "header") {
                      return (
                        <tr key={`${row.name}-${i}`} className="bg-[#1E3A5F]/25">
                          <td colSpan={5} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#7CB3E8]">
                            {row.name}
                          </td>
                        </tr>
                      );
                    }
                    const diff = row.amount - row.amountPrev;
                    const dPct =
                      row.amountPrev === 0
                        ? row.amount === 0
                          ? 0
                          : 100
                        : Math.round((diff / Math.abs(row.amountPrev)) * 100);
                    const isFinal = row.name.includes("LABA") || row.name.includes("RUGI");
                    const isTotal = row.kind === "total";
                    return (
                      <tr
                        key={`${row.name}-${i}`}
                        className={`border-b border-white/[0.04] ${
                          isFinal
                            ? "bg-emerald-500/10"
                            : isTotal
                              ? "bg-white/[0.04]"
                              : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td
                          className={`px-4 py-2 ${
                            isTotal ? "font-semibold text-white" : "pl-6 text-white/80"
                          } ${isFinal ? "font-bold" : ""}`}
                        >
                          {row.name}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${isFinal ? "font-bold text-emerald-300" : "text-white/90"}`}>
                          {fmtRpSigned(row.amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#8B8AA0]">
                          {fmtRpSigned(row.amountPrev)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono ${
                            diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-[#8B8AA0]"
                          }`}
                        >
                          {diff === 0 ? "—" : fmtRpSigned(diff)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Delta
                            pct={dPct}
                            invert={row.kind === "expense" || row.name === "Total Beban"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {plRows.filter((r) => r.kind === "income" || r.kind === "expense").length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#8B8AA0]">
                        Belum ada baris akun di periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tren penjualan + arus kas */}
          <div className="flex flex-col gap-4">
            <section className="flex-1 rounded-xl border border-white/10 bg-[#0F0F1A] p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Tren Penjualan Harian</h2>
                  <p className="text-[11px] text-[#8B8AA0]">Omzet vs beban per tanggal · {monthLabel}</p>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-[#8B8AA0]">
                    <span className="h-2 w-2 rounded-full bg-teal-400" /> Omzet
                  </span>
                  <span className="flex items-center gap-1 text-[#8B8AA0]">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> Beban
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gBeban" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={42} />
                  <Tooltip
                    contentStyle={TOOLTIP}
                    formatter={(v, name) => [fmtRpSigned(Number(v)), String(name) === "omzet" ? "Omzet" : "Beban"]}
                    labelFormatter={(l) => `Tanggal ${l}`}
                  />
                  <Area type="monotone" dataKey="omzet" stroke="#2DD4BF" strokeWidth={2} fill="url(#gOmzet)" dot={false} />
                  <Area type="monotone" dataKey="beban" stroke="#F59E0B" strokeWidth={1.5} fill="url(#gBeban)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section className="flex-1 rounded-xl border border-white/10 bg-[#0F0F1A] p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Arus Kas 12 Bulan</h2>
                  <p className="text-[11px] text-[#8B8AA0]">Kas masuk, keluar, dan saldo berjalan</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#8B8AA0]">Saldo kumulatif</p>
                  <p className="font-mono text-sm font-semibold text-[#7CB3E8]">
                    {fmtRpSigned(monthly[monthly.length - 1]?.saldo || 0)}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={monthly} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#8B8AA0", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={40} />
                  <YAxis yAxisId="left" tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={42} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={42} />
                  <Tooltip
                    contentStyle={TOOLTIP}
                    formatter={(v, name) => {
                      const map: Record<string, string> = {
                        masuk: "Kas masuk",
                        keluar: "Kas keluar",
                        saldo: "Saldo",
                      };
                      return [fmtRpSigned(Number(v)), map[String(name)] || String(name)];
                    }}
                  />
                  <Bar yAxisId="left" dataKey="masuk" fill="#2DD4BF" radius={[2, 2, 0, 0]} maxBarSize={14} />
                  <Bar yAxisId="left" dataKey="keluar" fill="#F59E0B" radius={[2, 2, 0, 0]} maxBarSize={14} />
                  <Line yAxisId="right" type="monotone" dataKey="saldo" stroke="#7CB3E8" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>
          </div>
        </div>

        {/* Bottom: beban pie + pendapatan + per bisnis */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-white/10 bg-[#0F0F1A] p-4">
            <h2 className="text-sm font-semibold text-white">Komposisi Beban</h2>
            <p className="mb-2 text-[11px] text-[#8B8AA0]">Distribusi pengeluaran · {monthLabel}</p>
            {pieData.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#8B8AA0]">Belum ada beban.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP} formatter={(v) => [fmtRpSigned(Number(v)), "Nominal"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-1 max-h-36 space-y-1.5 overflow-y-auto">
                  {byCategory.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-white/75">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="truncate capitalize">{c.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-white/90">
                        {c.share}% · {fmtShort(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0F0F1A] p-4">
            <h2 className="text-sm font-semibold text-white">Sumber Pendapatan</h2>
            <p className="mb-3 text-[11px] text-[#8B8AA0]">Kategori pemasukan terbesar</p>
            {byIncome.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#8B8AA0]">Belum ada pendapatan.</p>
            ) : (
              <div className="space-y-3">
                {byIncome.map((c) => (
                  <div key={c.name}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="capitalize text-white/80">{c.name}</span>
                      <span className="font-mono text-teal-300">{fmtRpSigned(c.amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-teal-400/80"
                        style={{ width: `${Math.max(3, c.share)}%` }}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-[#8B8AA0]">
                      <span>{c.share}% dari omzet</span>
                      <span>lalu {fmtShort(c.amountPrev)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0F0F1A] p-4">
            <h2 className="text-sm font-semibold text-white">Ringkasan per Bisnis</h2>
            <p className="mb-3 text-[11px] text-[#8B8AA0]">Omzet, beban, laba, margin</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-[#8B8AA0]">
                    <th className="pb-2 text-left font-medium">Bisnis</th>
                    <th className="pb-2 text-right font-medium">Omzet</th>
                    <th className="pb-2 text-right font-medium">Laba</th>
                    <th className="pb-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {byBusiness
                    .slice()
                    .sort((a, b) => b.omzet - a.omzet)
                    .map((b) => (
                      <tr key={b.id} className="border-b border-white/[0.04]">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-white/90">{b.name}</p>
                          <p className="text-[10px] capitalize text-[#8B8AA0]">
                            {b.type || "—"} · {b.orderCount} order
                          </p>
                        </td>
                        <td className="py-2 text-right font-mono text-white/85">{fmtShort(b.omzet)}</td>
                        <td
                          className={`py-2 text-right font-mono ${
                            b.laba >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {fmtShort(b.laba)}
                        </td>
                        <td className="py-2 text-right font-mono text-[#8B8AA0]">{b.margin}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <p className="pb-4 text-center text-[10px] text-[#8B8AA0]/70">
          Sumber otomatis: Keuangan Bisnis + Kasir F&amp;B (lewat transaksi) + AI Kasir (lewat order retail, tanpa dobel hitung).
          Void AI Kasir tidak dihitung. Angka dalam kurung = negatif.
        </p>
      </div>

      {pdfPreviewHtml && (
        <InventoryPrintPreview
          html={pdfPreviewHtml}
          title={`Laporan Analitik · ${monthLabel} · ${bizName}`}
          onClose={() => setPdfPreviewHtml(null)}
        />
      )}
    </div>
  );
}
