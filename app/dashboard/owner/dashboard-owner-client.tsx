"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search, ChevronDown, ChevronRight, X, Pencil, AlertTriangle,
  Printer, Plus, Calendar, Bell, Building2,
  TrendingUp, TrendingDown, ShoppingBag, Receipt, DollarSign,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { TopProduct, RecentTransaction } from "./page";
import OwnerKasirSummary, { type KasirTodaySummary } from "./owner-kasir-summary";
import OwnerKasirLive, { type LiveKasirRow } from "./owner-kasir-live";
import type { DayCloseData } from "@/app/dashboard/fnb/lib/day-close-report";

type Business = {
  id: string; name: string; type: string;
  omzetBulan: number; labaBulan: number; omzetBulanLalu: number; omzetTahun: number; growthPct: number;
  totalOrderBulan: number;
  stokKritis: { id: string; name: string; stock: number; min_stock: number }[];
  pengeluaranByCategory: Record<string, number>;
  targetOmzet: number; targetPct: number; margin: number;
  dailyMap: Record<string, number>;
};

const TYPE_COLOR: Record<string, string> = {
  kuliner: "#2DD4BF", ternak: "#8B5CF6", homeindustry: "#F59E0B", retail: "#EC4899", pertanian: "#22C55E",
  jasa: "#EC4899", wholesale: "#6366F1", olshop: "#F43F5E", kesehatan: "#10B981", bengkel: "#EF4444",
};
const TYPE_LABEL: Record<string, string> = {
  kuliner: "F&B / Kuliner", ternak: "Peternakan", homeindustry: "Home Industri", retail: "Retail",
  pertanian: "Pertanian", jasa: "Jasa", wholesale: "Grosir", olshop: "Online Shop", kesehatan: "Kesehatan", bengkel: "Bengkel",
};
const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const STATUS_STYLE: Record<string, string> = {
  Selesai: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Diproses: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

function fmtRp(n: number) {
  if (n >= 1000000) return "Rp" + (n / 1000000).toFixed(1).replace(".0", "") + "jt";
  if (n >= 1000) return "Rp" + Math.round(n / 1000) + "rb";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
function fmtFull(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function DashboardOwnerClient({
  businesses, topProducts, recentTransactions, kasirSummary, kasirBusinessName, liveKasir, dayCloseData, bulan, tahun, userId, userName,
}: {
  businesses: Business[];
  topProducts: TopProduct[];
  recentTransactions: RecentTransaction[];
  kasirSummary: KasirTodaySummary | null;
  kasirBusinessName?: string;
  liveKasir: LiveKasirRow[] | null;
  dayCloseData: DayCloseData | null;
  bulan: number; tahun: number; userId: string; userName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const rangeFilter = searchParams.get("range") || "month";
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedBiz, setSelectedBiz] = useState<string>("all");
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [chartTab, setChartTab] = useState("Harian");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const bizRef = useRef<HTMLDivElement>(null);

  const closeDropdowns = () => {
    setShowDatePicker(false);
    setShowBizDropdown(false);
  };

  useEffect(() => {
    if (!showDatePicker && !showBizDropdown) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dateRef.current?.contains(t) || bizRef.current?.contains(t)) return;
      closeDropdowns();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDropdowns(); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showDatePicker, showBizDropdown]);

  const filteredBusinesses = selectedBiz === "all" ? businesses : businesses.filter(b => b.id === selectedBiz);
  const totalOmzet = filteredBusinesses.reduce((s, b) => s + b.omzetBulan, 0);
  const totalLaba = filteredBusinesses.reduce((s, b) => s + Math.max(0, b.labaBulan), 0);
  const totalRugi = filteredBusinesses.reduce((s, b) => s + Math.abs(Math.min(0, b.labaBulan)), 0);
  const totalOrder = filteredBusinesses.reduce((s, b) => s + b.totalOrderBulan, 0);
  const avgOrder = totalOrder > 0 ? Math.round(totalOmzet / totalOrder) : 0;
  const avgGrowth = filteredBusinesses.length > 0
    ? Math.round(filteredBusinesses.reduce((s, b) => s + b.growthPct, 0) / businesses.length) : 0;
  const ranked = [...filteredBusinesses].sort((a, b) => b.labaBulan - a.labaBulan);
  const topGrowth = [...filteredBusinesses].sort((a, b) => b.growthPct - a.growthPct)[0];
  const topProfit = ranked[0];
  const topLoss = [...filteredBusinesses].sort((a, b) => a.labaBulan - b.labaBulan)[0];

  const alerts = businesses.filter(b => b.stokKritis.length > 0).map(b => ({
    id: "stok-" + b.id,
    title: b.name + " — " + b.stokKritis.length + " bahan hampir habis",
    sub: b.stokKritis.slice(0, 3).map(p => p.name).join(", "),
  }));
  const visibleAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id));

  const allExpenses: Record<string, number> = {};
  businesses.forEach(b => Object.entries(b.pengeluaranByCategory).forEach(([cat, amt]) => {
    allExpenses[cat] = (allExpenses[cat] || 0) + amt;
  }));
  const totalExpense = Object.values(allExpenses).reduce((s, v) => s + v, 0);

  const setRange = (r: string) => { router.push("/dashboard/owner?range=" + r); setShowDatePicker(false); };
  const applyCustom = () => {
    router.push("/dashboard/owner?range=custom&from=" + customFrom + "&to=" + customTo);
    setShowDatePicker(false);
  };

  const saveTarget = async (bizId: string) => {
    setSavingTarget(true);
    await supabase.from("business_targets").upsert(
      { business_id: bizId, user_id: userId, bulan, tahun, target_omzet: Number(targetInput) || 0 },
      { onConflict: "business_id,bulan,tahun" },
    );
    setSavingTarget(false); setEditingTarget(null); router.refresh();
  };

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const dateKey = tahun + "-" + String(bulan).padStart(2, "0") + "-" + day;
    const total = filteredBusinesses.reduce((s, b) => s + (b.dailyMap[dateKey] || 0), 0);
    return { day: i + 1, omzet: Math.round(total / 1000) };
  });

  const donutData = filteredBusinesses.filter(b => b.omzetBulan > 0)
    .map(b => ({ name: b.name, value: b.omzetBulan, color: TYPE_COLOR[b.type] || "#8b5cf6" }));

  const today = new Date();
  const dateLabel = today.getDate() + " " + BULAN[today.getMonth()] + " " + today.getFullYear();

  const kpis = [
    { label: "Total Omzet", value: fmtFull(totalOmzet), delta: avgGrowth, icon: TrendingUp, iconBg: "bg-violet-500/15", iconColor: "text-violet-400", positive: true },
    { label: "Total Laba", value: fmtFull(totalLaba), delta: avgGrowth, icon: DollarSign, iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400", positive: true },
    { label: "Total Rugi", value: fmtFull(totalRugi), delta: 0, icon: TrendingDown, iconBg: "bg-red-500/15", iconColor: "text-red-400", positive: false },
    { label: "Total Order", value: String(totalOrder), delta: 5, icon: ShoppingBag, iconBg: "bg-blue-500/15", iconColor: "text-blue-400", positive: true },
    { label: "Rata-rata Order", value: fmtRp(avgOrder), delta: 3, icon: Receipt, iconBg: "bg-amber-500/15", iconColor: "text-amber-400", positive: true },
  ];

  const periodBtn = (active: boolean) =>
    ["mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
      active ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-white/[0.04]"].join(" ");

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100">

      {(showDatePicker || showBizDropdown) && (
        <div
          className="no-print fixed inset-0 z-[35] bg-[#0b0e14]/50 backdrop-blur-[2px]"
          onClick={closeDropdowns}
          aria-hidden
        />
      )}

      {/* Header — greeting kiri, toolbar kanan; dropdown menempel ke tombol */}
      <header className="no-print sticky top-0 z-40 overflow-visible border-b border-white/[0.06] bg-[#0b0e14]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-8 lg:py-5">
          <div className="min-w-0 flex-shrink-0">
            <h1 className="truncate text-xl font-bold text-white lg:text-2xl">Halo, {userName} 👋</h1>
            <p className="mt-1 text-sm text-slate-500">Berikut ringkasan performa bisnismu · {BULAN[bulan - 1]} {tahun}</p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end lg:flex-nowrap">
            <div className="relative w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari bisnis..."
                className="h-9 w-full rounded-xl border border-white/[0.07] bg-[#151921] pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-violet-500/40" />
            </div>

            <div ref={dateRef} className="relative">
              <button
                type="button"
                onClick={() => { setShowBizDropdown(false); setShowDatePicker(v => !v); }}
                className={["dash-header-btn", showDatePicker ? "border-violet-500/40 text-slate-200" : ""].join(" ")}
                aria-expanded={showDatePicker}
              >
                <Calendar size={14} /><span className="hidden md:inline">{dateLabel}</span><ChevronDown size={13} className={showDatePicker ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {showDatePicker && (
                <div className="dash-dropdown scale-in absolute right-0 top-[calc(100%+8px)] z-[60] w-56">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Periode</p>
                  {[{ k: "today", l: "Hari ini" }, { k: "month", l: "Bulan ini" }, { k: "year", l: "Tahun ini" }].map(f => (
                    <button key={f.k} type="button" onClick={() => setRange(f.k)} className={periodBtn(rangeFilter === f.k)}>{f.l}</button>
                  ))}
                  <div className="my-2 border-t border-white/[0.06]" />
                  <p className="mb-1.5 text-[10px] font-medium text-slate-500">Rentang kustom</p>
                  <label className="mb-2 block">
                    <span className="mb-1 block text-[10px] text-slate-600">Dari</span>
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="dash-date-input" />
                  </label>
                  <label className="mb-3 block">
                    <span className="mb-1 block text-[10px] text-slate-600">Sampai</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="dash-date-input" />
                  </label>
                  <button type="button" onClick={applyCustom} className="mb-2 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2 text-xs font-bold text-white">Terapkan</button>
                  <button type="button" onClick={() => window.print()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] py-2 text-xs text-slate-400 hover:text-slate-200">
                    <Printer size={12} /> Cetak
                  </button>
                </div>
              )}
            </div>

            <div ref={bizRef} className="relative">
              <button
                type="button"
                onClick={() => { setShowDatePicker(false); setShowBizDropdown(v => !v); }}
                className={["dash-header-btn min-w-[130px] max-w-[180px]", showBizDropdown ? "border-violet-500/40 text-slate-200" : ""].join(" ")}
                aria-expanded={showBizDropdown}
              >
                <Building2 size={14} className="flex-shrink-0" />
                <span className="truncate">{selectedBiz === "all" ? "Semua Bisnis" : (businesses.find(b => b.id === selectedBiz)?.name || "Bisnis")}</span>
                <ChevronDown size={13} className={["flex-shrink-0 transition-transform", showBizDropdown ? "rotate-180" : ""].join(" ")} />
              </button>
              {showBizDropdown && (
                <div className="dash-dropdown scale-in absolute right-0 top-[calc(100%+8px)] z-[60] min-w-[220px] max-w-[280px] p-2">
                  <button type="button" onClick={() => { setSelectedBiz("all"); setShowBizDropdown(false); }}
                    className={["flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm", selectedBiz === "all" ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-white/[0.04]"].join(" ")}>
                    Semua Bisnis
                  </button>
                  {businesses.map(b => (
                    <button key={b.id} type="button" onClick={() => { setSelectedBiz(b.id); setShowBizDropdown(false); }}
                      className={["flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm", selectedBiz === b.id ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-white/[0.04]"].join(" ")}>
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: TYPE_COLOR[b.type] || "#8b5cf6" }} />
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#151921] text-slate-400 hover:border-white/[0.12] hover:text-slate-300">
              <Bell size={15} />
              {visibleAlerts.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{visibleAlerts.length}</span>
              )}
            </button>

            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
              {userName[0].toUpperCase()}
            </div>

            <button type="button" onClick={() => router.push("/dashboard/onboarding")}
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white hover:opacity-90">
              <Plus size={14} /> Bisnis
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 lg:px-8">

        {/* KPI */}
        <div className="owner-grid-kpi grid grid-cols-5 gap-4">
          {kpis.map((k, i) => (
            <div key={k.label} className="dashboard-card dashboard-card-hover fade-up flex min-h-[130px] flex-col p-4" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${k.iconBg}`}>
                  <k.icon size={18} className={k.iconColor} />
                </div>
                <span className="text-right text-[11px] leading-tight text-slate-500">{k.label}</span>
              </div>
              <p className="mb-auto text-lg font-bold leading-tight text-white xl:text-xl">{k.value}</p>
              <div className={`mt-2 flex items-center gap-1 text-[11px] ${k.positive ? "text-emerald-400" : "text-red-400"}`}>
                {k.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(k.delta)}% vs bulan lalu
              </div>
            </div>
          ))}
        </div>

        {/* Ranking semua bisnis — langsung terlihat */}
        {businesses.length > 0 && (
          <div className="dashboard-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <h2 className="dash-card-title">Performa {businesses.length} Bisnis Kamu</h2>
              <span className="text-xs text-slate-500">Data dari semua modul · keuangan · inventory · pertanian · ternak</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ranked.map((b, i) => (
                <div key={b.id} className="rounded-xl border border-white/[0.06] bg-[#0b0e14] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-slate-400">{i + 1}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[b.type] || "#8b5cf6" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{b.name}</p>
                      <p className="text-[10px] text-slate-500">{TYPE_LABEL[b.type] || b.type}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-slate-500">Omzet</p><p className="font-mono font-semibold text-violet-300">{fmtRp(b.omzetBulan)}</p></div>
                    <div><p className="text-slate-500">Laba/Rugi</p><p className={`font-mono font-semibold ${b.labaBulan >= 0 ? "text-emerald-400" : "text-red-400"}`}>{b.labaBulan >= 0 ? "+" : ""}{fmtRp(b.labaBulan)}</p></div>
                  </div>
                  {b.stokKritis.length > 0 && <p className="mt-2 text-[10px] text-amber-400">⚠ {b.stokKritis.length} stok kritis</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart + Alerts */}
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3 xl:gap-6">
          <div className="dashboard-card flex flex-col p-5 xl:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <h2 className="dash-card-title">Grafik Omzet</h2>
              <div className="flex gap-1 rounded-xl bg-[#0b0e14] p-1">
                {["Harian", "Mingguan", "Bulanan"].map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    className={["rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                      chartTab === t ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-300"].join(" ")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="omzetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={v => "Rp" + v + "rb"} width={55} />
                <Tooltip contentStyle={{ background: "#151921", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, fontSize: 12, color: "#f8fafc" }}
                  formatter={(v: unknown) => [fmtFull(Number(v) * 1000), "Omzet"]} />
                <Area type="monotone" dataKey="omzet" stroke="#7c3aed" strokeWidth={2.5} fill="url(#omzetGrad)" dot={false} activeDot={{ r: 5, fill: "#7c3aed" }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
              {[
                { label: "Omzet Tertinggi", value: fmtRp(Math.max(...chartData.map(d => d.omzet), 0) * 1000), dot: "#ef4444" },
                { label: "Omzet Terendah", value: fmtRp(Math.min(...chartData.filter(d => d.omzet > 0).map(d => d.omzet), 0) * 1000), dot: "#8b5cf6" },
                { label: "Rata-rata Harian", value: fmtRp(Math.round(totalOmzet / 30)), dot: "#f59e0b" },
                { label: "Growth Terbaik", value: (topGrowth?.growthPct ?? 0) + "%", sub: topGrowth?.name, dot: "#10b981" },
              ].map(s => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />{s.label}
                  </div>
                  <p className="text-sm font-semibold text-white">{s.value}</p>
                  {s.sub && <p className="truncate text-[10px] text-slate-600">{s.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card flex min-h-[340px] flex-col p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-4">
              <h2 className="dash-card-title">Perlu Perhatian</h2>
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-400">{visibleAlerts.length} alert</span>
            </div>
            <div className="flex flex-1 flex-col">
            {visibleAlerts.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-xl text-emerald-400">✓</div>
                <p className="text-sm text-slate-500">Semua aman</p>
              </div>
            ) : visibleAlerts.map(a => (
              <div key={a.id} className="flex items-start gap-2 border-b border-white/[0.04] py-2.5 last:border-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle size={14} className="text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{a.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{a.sub}</p>
                </div>
                <button onClick={() => router.push("/dashboard/inventory")} className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20">Lihat</button>
                <button onClick={() => setDismissedAlerts(p => [...p, a.id])} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.08] text-slate-500 hover:text-slate-300">
                  <X size={11} />
                </button>
              </div>
            ))}
            </div>
          </div>
        </div>

        {liveKasir && liveKasir.length > 0 && (
          <OwnerKasirLive rows={liveKasir} businessName={kasirBusinessName} />
        )}
        {kasirSummary && (
          <OwnerKasirSummary summary={kasirSummary} businessName={kasirBusinessName} dayCloseData={dayCloseData} />
        )}

        {/* Row bawah */}
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {/* Top Produk Terlaris */}
          <div className="dashboard-card dashboard-card-hover flex min-h-[300px] flex-col p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="dash-card-title">Top Produk Terlaris</h2>
              <button type="button" className="dash-card-link">Lihat Semua</button>
            </div>
            <div className="flex-1">
            {topProducts.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-slate-600">Belum ada data produk</p>
              : topProducts.map((p, i) => (
                <div key={p.id} className="mb-3 flex items-center gap-3 last:mb-0">
                  <span className="w-4 text-center text-[11px] font-bold text-slate-600">{i + 1}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b0e14] text-base">{p.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.sold > 0 ? p.sold + " terjual" : "Belum terjual"}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{fmtRp(p.revenue)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transaksi Terbaru */}
          <div className="dashboard-card dashboard-card-hover flex min-h-[300px] flex-col p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="dash-card-title">Transaksi Terbaru</h2>
              <button type="button" className="dash-card-link">Lihat Semua</button>
            </div>
            <div className="flex-1">
            {recentTransactions.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-slate-600">Belum ada transaksi</p>
              : recentTransactions.map(tx => (
                <div key={tx.id} className="mb-3 flex items-center gap-3 last:mb-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 text-xs font-bold text-violet-300">
                    {tx.customer[0]?.toUpperCase() || "P"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{tx.customer}</p>
                    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[tx.status]}`}>{tx.status}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{fmtRp(tx.amount)}</p>
                    <p className="text-[10px] text-slate-600">{tx.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Channel Penjualan */}
          <div className="dashboard-card dashboard-card-hover flex min-h-[300px] flex-col p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="dash-card-title">Channel Penjualan</h2>
              <button type="button" className="dash-card-link">Detail</button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center">
            {donutData.length === 0 ? <p className="text-sm text-slate-600">Belum ada data</p> : (
              <>
                <div className="relative mx-auto mb-3" style={{ width: 130, height: 130 }}>
                  <PieChart width={130} height={130}>
                    <Pie data={donutData} cx={65} cy={65} innerRadius={40} outerRadius={58} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-500">Total</p>
                    <p className="text-xs font-bold text-white">{fmtRp(totalOmzet)}</p>
                  </div>
                </div>
                {donutData.map(d => (
                  <div key={d.name} className="mb-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 truncate text-[11px] text-slate-400">{d.name}</span>
                    <span className="text-[11px] text-slate-500">{totalOmzet > 0 ? Math.round(d.value / totalOmzet * 100) : 0}%</span>
                    <span className="text-[11px] font-medium text-slate-300">{fmtRp(d.value)}</span>
                  </div>
                ))}
              </>
            )}
            </div>
          </div>

          {/* Insight Gercep */}
          <div className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-violet-500/25 p-5"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(79,70,229,0.08))" }}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <span className="inline-flex rounded-lg bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">✦ Insight Gercep</span>
                <span className="ml-2 rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">Baru</span>
              </div>
              <span className="text-2xl leading-none">🌾</span>
            </div>
            <div className="flex-1 space-y-2 text-[12px] leading-relaxed text-slate-400">
              {topProfit && (
                <div className="flex gap-2">
                  <span className="flex-shrink-0 text-emerald-400">✓</span>
                  <span>Paling untung: <strong className="text-slate-200">{topProfit.name}</strong> ({fmtRp(topProfit.labaBulan)}).</span>
                </div>
              )}
              {topLoss && topLoss.labaBulan < 0 && (
                <div className="flex gap-2">
                  <span className="flex-shrink-0 text-red-400">↓</span>
                  <span>Perlu perhatian: <strong className="text-slate-200">{topLoss.name}</strong> rugi {fmtRp(Math.abs(topLoss.labaBulan))}.</span>
                </div>
              )}
              {topGrowth && (
                <div className="flex gap-2">
                  <span className="flex-shrink-0 text-emerald-400">✓</span>
                  <span><strong className="text-slate-200">{topGrowth.name}</strong> {topGrowth.growthPct >= 0 ? "tumbuh" : "turun"} {Math.abs(topGrowth.growthPct)}%.</span>
                </div>
              )}
              {visibleAlerts.length > 0 && (
                <div className="flex gap-2">
                  <span className="flex-shrink-0 text-amber-400">⚠</span>
                  <span>{visibleAlerts.length} bisnis stok hampir habis.</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="flex-shrink-0 text-emerald-400">✓</span>
                <span>{businesses.length} bisnis aktif · {totalOrder} order · omzet {fmtRp(totalOmzet)}.</span>
              </div>
            </div>
            <Link href="/dashboard/chat"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-300 hover:bg-violet-500/20">
              ✨ Tanya Gercep
            </Link>
            <button type="button" onClick={() => setShowAdvanced(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              Lihat Analisis Lengkap <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Fitur Gercep — collapsible agar halaman lebih rapi */}
        <div className="border-t border-white/[0.06] pt-4">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="mb-4 flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-[#151921]/50 px-4 py-3 text-left transition-colors hover:border-violet-500/25">
            <span className="text-sm font-semibold text-slate-300">Analisis Bisnis Lanjutan</span>
            <span className="flex items-center gap-2 text-xs text-violet-400">
              Ranking · Performa · Target · Ekspor
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {showAdvanced && (
          <div className="space-y-4 fade-up">
          <div className="owner-grid-2 grid grid-cols-2 gap-4">
            <div className="dashboard-card p-5">
              <p className="dash-card-title mb-4 border-b border-white/[0.06] pb-3">Ranking Bisnis Paling Untung</p>
              {ranked.map((b, i) => {
                const maxLaba = Math.max(...ranked.map(x => Math.max(0, x.labaBulan)), 1);
                return (
                  <div key={b.id} className={["flex items-center gap-2.5 py-2", i < ranked.length - 1 ? "border-b border-white/[0.04]" : ""].join(" ")}>
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[10px] font-bold text-slate-400">{i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="truncate text-slate-200">{b.name}</span>
                        <span className="ml-2 font-mono text-[#2DD4BF]">{fmtRp(Math.max(0, b.labaBulan))}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded bg-white/[0.04]">
                        <div className="h-full rounded" style={{ width: Math.max(0, b.labaBulan) / maxLaba * 100 + "%", background: TYPE_COLOR[b.type] || "#8B8AA0" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dashboard-card p-5">
              <p className="dash-card-title mb-4 border-b border-white/[0.06] pb-3">Performa Per Bisnis</p>
              {businesses.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).map(b => (
                <div key={b.id}>
                  <div onClick={() => setExpandedRow(expandedRow === b.id ? null : b.id)}
                    className="flex cursor-pointer items-center gap-2 border-b border-white/[0.04] py-2 hover:bg-white/[0.02]">
                    {expandedRow === b.id ? <ChevronDown size={11} className="text-slate-500" /> : <ChevronRight size={11} className="text-slate-500" />}
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLOR[b.type] || "#8B8AA0" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-slate-200">{b.name}</p>
                      <p className="text-[10px] text-slate-500">{TYPE_LABEL[b.type] || b.type}</p>
                    </div>
                    <p className={`font-mono text-xs ${b.labaBulan >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]"}`}>{fmtRp(b.omzetBulan)}</p>
                  </div>
                  {expandedRow === b.id && (
                    <div className="my-1 rounded-lg bg-[#0b0e14] p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {[["Omzet", fmtFull(b.omzetBulan)], ["Laba/Rugi", (b.labaBulan >= 0 ? "+" : "") + fmtFull(b.labaBulan)], ["Margin", b.margin + "%"], ["Order", String(b.totalOrderBulan)]].map(([k, v]) => (
                          <div key={k} className="rounded-md border border-white/[0.05] bg-[#151921] p-2">
                            <p className="text-[10px] text-slate-500">{k}</p>
                            <p className="font-mono text-xs font-semibold">{v}</p>
                          </div>
                        ))}
                      </div>
                      {b.stokKritis.length > 0 && (
                        <p className="mt-2 rounded-md border border-amber-500/15 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-400">
                          Stok kritis: {b.stokKritis.map(p => p.name).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {totalExpense > 0 && (
            <div className="dashboard-card p-5">
              <p className="dash-card-title mb-4 border-b border-white/[0.06] pb-3">Breakdown Pengeluaran</p>
              {Object.entries(allExpenses).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <div key={cat} className="mb-2 flex items-center gap-2">
                  <span className="w-28 flex-shrink-0 truncate text-xs text-slate-400">{cat}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/[0.04]">
                    <div className="h-full rounded bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6]" style={{ width: amt / totalExpense * 100 + "%" }} />
                  </div>
                  <span className="w-20 flex-shrink-0 text-right font-mono text-xs">{fmtFull(amt)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="owner-grid-2 grid grid-cols-2 gap-4">
            <div className="dashboard-card p-5">
              <p className="dash-card-title mb-4 border-b border-white/[0.06] pb-3">Target Omzet</p>
              {businesses.map(b => {
                const pct = Math.min(100, b.targetPct);
                const color = pct >= 90 ? "#2DD4BF" : pct >= 50 ? "#F59E0B" : "#EC4899";
                return (
                  <div key={b.id} className="mb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex-1 truncate text-xs text-slate-300">{b.name}</span>
                      <div className="ml-2 flex items-center gap-1.5">
                        <span className="font-mono text-[10px]" style={{ color }}>{b.targetOmzet > 0 ? pct + "%" : "-"}</span>
                        <button type="button" onClick={() => { setEditingTarget(b.id); setTargetInput(String(b.targetOmzet)); }}
                          className="flex h-4 w-4 items-center justify-center rounded border border-white/[0.08] text-slate-500 hover:text-slate-300">
                          <Pencil size={9} />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-white/[0.04]">
                      <div className="h-full rounded" style={{ width: pct + "%", background: color }} />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
                      <span>{fmtRp(b.omzetBulan)}</span>
                      <span>{b.targetOmzet > 0 ? fmtRp(b.targetOmzet) : "Belum diset"}</span>
                    </div>
                    {editingTarget === b.id && (
                      <div className="mt-1.5 flex gap-1.5">
                        <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="Target (Rp)"
                          className="flex-1 rounded-md border border-white/[0.08] bg-[#0b0e14] px-2 py-1 font-mono text-xs outline-none" />
                        <button type="button" onClick={() => saveTarget(b.id)} disabled={savingTarget}
                          className="rounded-md bg-[#2DD4BF] px-2.5 py-1 text-xs font-bold text-[#070711] disabled:opacity-50">
                          {savingTarget ? "..." : "✓"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="dashboard-card p-5">
              <p className="dash-card-title mb-4 border-b border-white/[0.06] pb-3">Ekspor Rekap</p>
              {[
                { icon: "📊", label: "Excel · semua bisnis" },
                { icon: "📄", label: "PDF · laporan bulanan" },
                { icon: "💬", label: "Kirim ke WhatsApp" },
                { icon: "⏰", label: "Jadwalkan otomatis" },
              ].map((item, i) => (
                <div key={i} className={["flex cursor-pointer items-center justify-between py-2 hover:text-slate-300", i < 3 ? "border-b border-white/[0.04]" : ""].join(" ")}>
                  <span className="text-xs text-slate-400">{item.icon} {item.label}</span>
                  <ChevronRight size={11} className="text-slate-600" />
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <button type="button" className="flex-1 rounded-lg border border-white/[0.08] bg-[#151921] py-2 text-xs text-slate-400 hover:border-white/15">Preview</button>
                <button type="button" className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2 text-xs font-bold text-white hover:opacity-90">Unduh</button>
              </div>
            </div>
          </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
