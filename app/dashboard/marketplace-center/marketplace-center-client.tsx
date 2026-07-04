"use client";
import { useState } from "react";
import { ShoppingCart, LayoutDashboard, Store, Package, ClipboardList, BarChart3 } from "lucide-react";
import type { MpStore, MpProduct, MpOrder } from "./page";
import MpDashboardTab from "./components/mp-dashboard-tab";
import MpStoresTab from "./components/mp-stores-tab";
import MpProductsTab from "./components/mp-products-tab";
import MpOrdersTab from "./components/mp-orders-tab";
import MpAnalyticsTab from "./components/mp-analytics-tab";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "toko", label: "Toko", icon: Store },
  { id: "produk", label: "Produk", icon: Package },
  { id: "pesanan", label: "Pesanan", icon: ClipboardList },
  { id: "analitik", label: "Analitik", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MarketplaceCenterClient({
  userId, stores, products, orders,
}: {
  userId: string;
  stores: MpStore[]; products: MpProduct[]; orders: MpOrder[];
}) {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-6 pb-12">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ShoppingCart size={24} className="text-[#2DD4BF]" />
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Marketplace Center</h1>
          <p className="text-xs text-[#8B8AA0]">Kelola dan analisis semua toko online kamu dalam satu tempat</p>
        </div>
        <span className="rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#F59E0B]">Beta</span>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0D0D1A] p-1 scrollbar-none">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors " +
                (active
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : "text-[#5A5B7A] hover:text-[#8B8AA0]")
              }
            >
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && <MpDashboardTab stores={stores} products={products} orders={orders} />}
      {tab === "toko" && <MpStoresTab stores={stores} userId={userId} />}
      {tab === "produk" && <MpProductsTab stores={stores} products={products} userId={userId} />}
      {tab === "pesanan" && <MpOrdersTab stores={stores} orders={orders} userId={userId} />}
      {tab === "analitik" && <MpAnalyticsTab stores={stores} products={products} orders={orders} />}
    </div>
  );
}
