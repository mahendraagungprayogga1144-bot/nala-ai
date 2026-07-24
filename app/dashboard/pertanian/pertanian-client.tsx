"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wheat, MapPin, Sparkles, MessageCircle, Sprout, TrendingUp, AlertTriangle,
  Plus, Home, PenLine, Database,
} from "lucide-react";
import type { AgriDashboardData } from "./lib/types";
import { AGRI_TABS, type AgriTabId, cardCls, fmtRp, isHarvestCategory, isSaprotanCategory } from "./lib/constants";
import { computeAgriInsights, computeHPP } from "./lib/ai-insights";
import HarvestModule from "./components/harvest-module";
import SaprotanModule from "./components/saprotan-module";
import FieldsModule from "./components/fields-module";
import SprayingModule from "./components/spraying-module";
import CostsModule from "./components/costs-module";
import AiInsightModule from "./components/ai-insight-module";
import AgriCharts from "./components/agri-charts-lazy";
import AgriHubNav from "./agri-hub-nav";
import QuickAddSheet, { type QuickAddType } from "./components/quick-add-sheet";
import SetupWizard from "./components/setup-wizard";

type MobileView = "beranda" | "catat" | "data" | "ai";

const QUICK_ACTIONS: { type: QuickAddType; label: string; emoji: string; color: string }[] = [
  { type: "panen", label: "Hasil Panen", emoji: "🌾", color: "from-emerald-600/20 to-emerald-600/5 border-emerald-500/20" },
  { type: "saprotan", label: "Pupuk & Saprotan", emoji: "🧪", color: "from-violet-600/20 to-violet-600/5 border-violet-500/20" },
  { type: "lahan", label: "Lahan", emoji: "📍", color: "from-blue-600/20 to-blue-600/5 border-blue-500/20" },
  { type: "biaya", label: "Biaya", emoji: "💰", color: "from-amber-600/20 to-amber-600/5 border-amber-500/20" },
  { type: "semprot", label: "Penyemprotan", emoji: "💧", color: "from-cyan-600/20 to-cyan-600/5 border-cyan-500/20" },
];

const DATA_TABS: { id: AgriTabId; label: string }[] = [
  { id: "panen", label: "Panen" },
  { id: "saprotan", label: "Saprotan" },
  { id: "lahan", label: "Lahan" },
  { id: "semprot", label: "Semprot" },
  { id: "biaya", label: "Biaya" },
];

export default function PertanianClient({ data, businessName, userId, businessId }: {
  data: AgriDashboardData;
  businessName: string;
  userId: string;
  businessId: string;
}) {
  const [mobileView, setMobileView] = useState<MobileView>("beranda");
  const [dataTab, setDataTab] = useState<AgriTabId>("dashboard");
  const [quickAdd, setQuickAdd] = useState<QuickAddType | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const isEmpty = data.fields.length === 0 && data.products.length === 0;

  useEffect(() => {
    if (isEmpty && typeof window !== "undefined" && !localStorage.getItem(`gercep_agri_setup_${businessId}`)) {
      setShowSetup(true);
    }
  }, [isEmpty, businessId]);

  const harvestProducts = data.products.filter(p => isHarvestCategory(p.category));
  const saprotanProducts = data.products.filter(p => isSaprotanCategory(p.category));
  const totalPanenValue = harvestProducts.reduce((s, p) => s + (p.price || 0) * p.stock, 0);
  const lowSaprotan = saprotanProducts.filter(p => p.stock <= p.min_stock).length;
  const { margin, roi } = computeHPP(data);
  const predictedProfit = totalPanenValue - computeHPP(data).totalCost;
  const insights = computeAgriInsights(data);

  const kpis = [
    { label: "Lahan", value: String(data.fields.length), icon: MapPin, color: "#8b5cf6" },
    { label: "Nilai Panen", value: fmtRp(totalPanenValue), icon: Wheat, color: "#2dd4bf" },
    { label: "Prediksi Untung", value: fmtRp(predictedProfit), icon: TrendingUp, color: predictedProfit >= 0 ? "#2dd4bf" : "#ec4899" },
  ];

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-[1600px] mx-auto pb-24 md:pb-8">
      {showSetup && (
        <SetupWizard businessId={businessId} userId={userId} onDone={() => setShowSetup(false)} />
      )}

      <QuickAddSheet type={quickAdd} onClose={() => setQuickAdd(null)} userId={userId} businessId={businessId} />

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sprout size={22} className="text-emerald-400" />
          <h1 className="text-xl sm:text-2xl font-semibold">Pertanian</h1>
        </div>
        <p className="text-[#8B8AA0] text-sm">{businessName}</p>
      </div>

      <AgriHubNav />

      <p className="mb-5 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] leading-relaxed text-[#5A5B7A]" style={{ background: "#0D0D1A" }}>
        <span className="text-[#2DD4BF] font-medium">Alur:</span> Catat lahan & biaya → input panen → jual di{" "}
        <Link href="/dashboard/inventory" className="text-[#2DD4BF] underline">Stok & Jual Panen</Link>.
      </p>

      {/* Mobile: main views */}
      <div className="md:hidden">
        {mobileView === "beranda" && (
          <div className="space-y-4 fade-up">
            <Link href="/dashboard/chat?context=pertanian"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-base font-bold text-white active:scale-[0.98]">
              <MessageCircle size={20} /> ✨ Tanya Gercep — Paling Mudah!
            </Link>

            <div className="grid grid-cols-3 gap-2">
              {kpis.map(k => (
                <div key={k.label} className={`${cardCls} p-3 text-center`}>
                  <k.icon size={16} style={{ color: k.color }} className="mx-auto mb-1" />
                  <p className="text-[9px] text-[#8B8AA0]">{k.label}</p>
                  <p className="text-xs font-semibold font-mono mt-0.5">{k.value}</p>
                </div>
              ))}
            </div>

            {lowSaprotan > 0 && (
              <div className={`${cardCls} p-3 flex items-center gap-2 border-amber-500/20`}>
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-200">{lowSaprotan} saprotan stok menipis</p>
              </div>
            )}

            <div className={`${cardCls} p-4 border-violet-500/15`}>
              <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1"><Sparkles size={12} /> Insight Gercep</p>
              <p className="text-sm text-[#8B8AA0] leading-relaxed">{insights[0]?.body || "Catat data dulu, Gercep akan kasih saran."}</p>
              <button type="button" onClick={() => setMobileView("ai")} className="text-xs text-violet-400 mt-2">Lihat semua →</button>
            </div>

            <p className="text-xs text-[#5A5B7A] text-center">Margin {margin.toFixed(0)}% · ROI {roi.toFixed(0)}%</p>
          </div>
        )}

        {mobileView === "catat" && (
          <div className="space-y-3 fade-up">
            <p className="text-sm text-[#8B8AA0] mb-2">Tap untuk catat — cuma 2-3 field</p>
            {QUICK_ACTIONS.map(a => (
              <button key={a.type} type="button" onClick={() => setQuickAdd(a.type)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-r ${a.color} active:scale-[0.98] transition-transform text-left`}>
                <span className="text-2xl">{a.emoji}</span>
                <span className="text-base font-semibold flex-1">{a.label}</span>
                <Plus size={20} className="text-white/50" />
              </button>
            ))}
            <Link href="/dashboard/chat?context=pertanian"
              className="block w-full py-3.5 rounded-2xl border border-dashed border-violet-500/30 text-center text-sm text-violet-400">
              Atau ketik aja ke Gercep Chat →
            </Link>
          </div>
        )}

        {mobileView === "data" && (
          <div className="fade-up">
            <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none">
              {DATA_TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setDataTab(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap ${dataTab === t.id ? "bg-violet-600/25 text-violet-300" : "bg-white/[0.04] text-[#8B8AA0]"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {dataTab === "panen" && <HarvestModule products={data.products} harvestMeta={data.harvestMeta} userId={userId} businessId={businessId} compact />}
            {dataTab === "saprotan" && <SaprotanModule products={data.products} saprotanMeta={data.saprotanMeta} userId={userId} businessId={businessId} compact />}
            {dataTab === "lahan" && <FieldsModule fields={data.fields} userId={userId} businessId={businessId} compact />}
            {dataTab === "semprot" && <SprayingModule records={data.spraying} userId={userId} businessId={businessId} compact />}
            {dataTab === "biaya" && <CostsModule costs={data.costs} userId={userId} businessId={businessId} dashboardData={data} compact />}
          </div>
        )}

        {mobileView === "ai" && <AiInsightModule data={data} />}
      </div>

      {/* Desktop: keep richer layout */}
      <div className="hidden md:block">
        <div className="flex justify-end mb-4">
          <Link href="/dashboard/chat?context=pertanian"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white">
            <MessageCircle size={16} /> Tanya Gercep Pertanian
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {QUICK_ACTIONS.map(a => (
            <button key={a.type} type="button" onClick={() => setQuickAdd(a.type)}
              className={`${cardCls} p-4 text-left hover:border-violet-500/30 transition-colors`}>
              <span className="text-xl">{a.emoji}</span>
              <p className="text-sm font-medium mt-2">{a.label}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {kpis.map(k => (
            <div key={k.label} className={`${cardCls} p-4`}>
              <k.icon size={16} style={{ color: k.color }} className="mb-2" />
              <p className="text-[10px] text-[#8B8AA0]">{k.label}</p>
              <p className="text-lg font-semibold font-mono">{k.value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {AGRI_TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setDataTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap ${dataTab === t.id ? "bg-violet-600/20 text-violet-300 border border-violet-500/30" : "text-[#8B8AA0]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {dataTab === "dashboard" && (
          <div className="space-y-4">
            <AgriCharts data={data} />
            <AiInsightModule data={data} />
          </div>
        )}
        {dataTab === "panen" && <HarvestModule products={data.products} harvestMeta={data.harvestMeta} userId={userId} businessId={businessId} />}
        {dataTab === "saprotan" && <SaprotanModule products={data.products} saprotanMeta={data.saprotanMeta} userId={userId} businessId={businessId} />}
        {dataTab === "lahan" && <FieldsModule fields={data.fields} userId={userId} businessId={businessId} />}
        {dataTab === "semprot" && <SprayingModule records={data.spraying} userId={userId} businessId={businessId} />}
        {dataTab === "biaya" && <CostsModule costs={data.costs} userId={userId} businessId={businessId} dashboardData={data} />}
        {dataTab === "insight" && <AiInsightModule data={data} />}
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0D0D1A]/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {([
            { id: "beranda" as const, icon: Home, label: "Beranda" },
            { id: "catat" as const, icon: PenLine, label: "Catat" },
            { id: "data" as const, icon: Database, label: "Data" },
            { id: "ai" as const, icon: Sparkles, label: "Gercep" },
          ]).map(item => (
            <button key={item.id} type="button" onClick={() => setMobileView(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors ${mobileView === item.id ? "text-violet-400" : "text-[#5A5B7A]"}`}>
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
