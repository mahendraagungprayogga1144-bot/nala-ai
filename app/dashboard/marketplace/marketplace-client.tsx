"use client";
import { useState } from "react";
import { ShoppingBag, Upload, BarChart3, Calculator } from "lucide-react";
import type { MpReport, MpParsedOrder } from "./page";
import MpUploadTab from "./components/mp-upload-tab";
import MpReportDashboard from "./components/mp-report-dashboard";
import MpPriceCalculator from "./components/mp-price-calculator";

const TABS = [
  { id: "upload", label: "Upload Laporan", icon: Upload },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "kalkulator", label: "Kalkulator Harga", icon: Calculator },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MarketplaceClient({
  businessId, businessName, userId, reports, parsedOrders,
}: {
  businessId: string; businessName: string; userId: string;
  reports: MpReport[]; parsedOrders: MpParsedOrder[];
}) {
  const [tab, setTab] = useState<TabId>("upload");

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-6 pb-12" style={{ background: "#070711" }}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ShoppingBag size={24} className="text-[#2DD4BF]" />
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Marketplace</h1>
          <p className="text-xs text-[#8B8AA0]">{businessName} — Upload & Analisis Laporan Marketplace</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] p-1 scrollbar-none" style={{ background: "#0D0D1A" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors " +
                (active ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#5A5B7A] hover:text-[#8B8AA0]")
              }
            >
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "upload" && <MpUploadTab businessId={businessId} userId={userId} reports={reports} />}
      {tab === "dashboard" && <MpReportDashboard reports={reports} parsedOrders={parsedOrders} />}
      {tab === "kalkulator" && <MpPriceCalculator parsedOrders={parsedOrders} />}
    </div>
  );
}
