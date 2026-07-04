"use client";
import { useState } from "react";
import { Receipt, ShoppingCart, Clock, BarChart3 } from "lucide-react";
import type { Product, KasirShift, TodayTx } from "./page";
import KasirPOS from "./components/kasir-pos";
import KasirShiftPanel from "./components/kasir-shift";
import KasirRekap from "./components/kasir-rekap";

const TABS = [
  { id: "kasir", label: "Kasir", icon: ShoppingCart },
  { id: "shift", label: "Shift", icon: Clock },
  { id: "rekap", label: "Rekap", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AiKasirClient({
  userId, businessId, businessName, products, activeShift, todayTransactions, todayShifts, today,
}: {
  userId: string; businessId: string; businessName: string;
  products: Product[]; activeShift: KasirShift | null;
  todayTransactions: TodayTx[]; todayShifts: KasirShift[];
  today: string;
}) {
  const [tab, setTab] = useState<TabId>("kasir");

  const omzetHariIni = todayTransactions.reduce((s, t) => s + Number(t.amount), 0);
  const totalOrder = todayTransactions.length;

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-6 pb-12" style={{ background: "#070711" }}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Receipt size={24} className="text-[#2DD4BF]" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">
            <span className="bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] bg-clip-text text-transparent">AI Kasir</span>
          </h1>
          <p className="text-xs text-[#8B8AA0]">Kasir universal — semua jenis bisnis</p>
        </div>
        {businessName && (
          <span className="rounded-full border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-1 text-xs text-[#2DD4BF] truncate max-w-[40%]">
            {businessName}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] p-1 scrollbar-none" style={{ background: "#0D0D1A" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-medium transition-colors " +
                (active ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#5A5B7A] hover:text-[#8B8AA0]")}>
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "kasir" && (
        <KasirPOS
          userId={userId}
          businessId={businessId}
          businessName={businessName}
          products={products}
          activeShift={activeShift}
          today={today}
          omzetHariIni={omzetHariIni}
          totalOrder={totalOrder}
        />
      )}
      {tab === "shift" && (
        <KasirShiftPanel
          userId={userId}
          businessId={businessId}
          activeShift={activeShift}
          todayShifts={todayShifts}
          omzetHariIni={omzetHariIni}
          totalOrder={totalOrder}
        />
      )}
      {tab === "rekap" && (
        <KasirRekap
          todayTransactions={todayTransactions}
          todayShifts={todayShifts}
          omzetHariIni={omzetHariIni}
          totalOrder={totalOrder}
          today={today}
        />
      )}
    </div>
  );
}
