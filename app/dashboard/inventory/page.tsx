import { createClient } from "@/lib/supabase/server";
import ProductForm from "./product-form";
import ProductList from "./product-list";
import InventoryCharts from "./inventory-charts";
import TrendChart from "./trend-chart";
import RecentMovements from "./recent-movements";
import MovementsChart from "./movements-chart";
import ProfitIndicator from "./profit-indicator";
import LossBreakdownChart from "./loss-breakdown-chart";
import MonthYearFilter from "../month-year-filter";
import { Package, AlertTriangle, Wallet, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import { getConfig } from "./business-config";
import LivestockInventory from "./livestock-inventory";
import HomeIndustryInventory from "./home-industry-inventory";
import FnBInventory from "./fnb-inventory";
import AgricultureInventory from "./agriculture-inventory";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ bulan?: string; tahun?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;

  const now = new Date();
  const bulan = Number(params.bulan) || now.getMonth() + 1;
  const tahun = Number(params.tahun) || now.getFullYear();

  const startDate = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const endDate = new Date(tahun, bulan, 0).toISOString().split("T")[0];

  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  const cookieStore = await (await import("next/headers")).cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses")
    .select("id, type, name")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  const business = businessData?.find((b) => b.id === activeBusinessId) || businessData?.[0] || null;
  const config = getConfig(business?.type);

  const { data: products } = await supabase.from("products").select("*").eq("business_id", business?.id || "").order("name", { ascending: true });

  let harvestMeta: { product_id: string; satuan: string | null }[] = [];
  let saprotanMeta: { product_id: string; satuan: string | null }[] = [];
  if (business?.type === "pertanian" && business.id) {
    const [{ data: hm }, { data: sm }] = await Promise.all([
      supabase.from("agri_harvest_meta").select("product_id, satuan").eq("business_id", business.id),
      supabase.from("agri_saprotan_meta").select("product_id, satuan").eq("business_id", business.id),
    ]);
    harvestMeta = hm || [];
    saprotanMeta = sm || [];
  }

  const productIds = products?.map(p => p.id) || [];

  const movementsQuery = productIds.length > 0
    ? supabase
        .from("stock_movements")
        .select("id, type, reason, quantity, note, profit_loss, created_at, movement_date, products(name)")
        .in("product_id", productIds)
        .gte("movement_date", startDate)
        .lte("movement_date", endDate)
        .order("movement_date", { ascending: false })
        .limit(20)
    : Promise.resolve({ data: [] as never[] });

  const allMovementsQuery = productIds.length > 0
    ? supabase
        .from("stock_movements")
        .select("profit_loss, reason")
        .in("product_id", productIds)
    : Promise.resolve({ data: [] as never[] });

  const [{ data: movements }, { data: allMovements }] = await Promise.all([movementsQuery, allMovementsQuery]);

  const totalRealizedProfit = allMovements?.reduce((sum, m) => sum + Number(m.profit_loss || 0), 0) || 0;
  const totalProducts = products?.length || 0;
  const lowStockCount = products?.filter((p) => p.stock <= p.min_stock).length || 0;
  const totalValue = products?.reduce((sum, p) => sum + (p.price || 0) * p.stock, 0) || 0;
  const avgPrice = totalProducts > 0 ? (products!.reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts) : 0;

  await supabase.from("inventory_history").upsert(
    { user_id: user!.id, business_id: business?.id, snapshot_date: new Date().toISOString().split("T")[0], total_value: totalValue },
    { onConflict: "user_id,snapshot_date" }
  );

  const { data: history } = await supabase
    .from("inventory_history")
    .select("snapshot_date, total_value")
    .eq("user_id", user!.id)
    .order("snapshot_date", { ascending: true })
    .limit(30);

  const kpis = [
    { label: config.kpiLabel.total, value: totalProducts, icon: Package, color: "#38BDF8" },
    { label: config.kpiLabel.lowStock, value: lowStockCount, icon: AlertTriangle, color: "#EC4899" },
    { label: config.kpiLabel.nilai, value: `Rp${totalValue.toLocaleString("id-ID")}`, icon: Wallet, color: "#2DD4BF" },
    { label: config.kpiLabel.rataHarga, value: `Rp${Math.round(avgPrice).toLocaleString("id-ID")}`, icon: TrendingUp, color: "#8B5CF6" },
  ];

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">{business?.type === "kuliner" ? "Stok Bahan" : "Inventory"}</h1>
        {business?.name && <span className="text-xs text-[#8B8AA0] bg-white/5 px-3 py-1 rounded-full">{business.name}</span>}
      </div>
      {business?.type === "kuliner" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok bahan → buat menu + resep → jual di kasir. Stok otomatis berkurang.</p>
      ) : (
        <p className="text-[#8B8AA0] mb-8">{config.produkLabel} dan stok kamu.</p>
      )}

      {business?.type !== "homeindustry" && business?.type !== "ternak" && business?.type !== "kuliner" && business?.type !== "pertanian" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {kpis.map((k) => (
            <div key={k.label} className="relative bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 overflow-hidden">
              <div className="absolute w-20 h-20 rounded-full -top-6 -right-6" style={{ background: k.color, filter: "blur(40px)", opacity: 0.2 }} />
              <k.icon size={18} style={{ color: k.color }} className="mb-3 relative" />
              <p className="text-xs text-[#8B8AA0] mb-1 relative">{k.label}</p>
              <p className="text-lg font-mono font-semibold relative">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {business?.type === "ternak" ? (
        <div className="mb-8">
          <LivestockInventory products={products || []} userId={user!.id} businessId={business?.id} />
        </div>
      ) : business?.type === "homeindustry" ? (
        <div className="mb-8">
          <HomeIndustryInventory products={products || []} userId={user!.id} businessId={business?.id} />
        </div>
      ) : business?.type === "kuliner" ? (
        <div className="mb-8">
          <FnBInventory products={products || []} userId={user!.id} businessId={business?.id} />
        </div>
      ) : business?.type === "pertanian" ? (
        <div className="mb-8">
          <AgricultureInventory
            products={products || []}
            harvestMeta={harvestMeta as never}
            saprotanMeta={saprotanMeta as never}
            userId={user!.id}
            businessId={business?.id}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 mb-8">
          <ProductForm userId={user!.id} businessId={business?.id} nextSkuNumber={totalProducts + 1} config={config} />
          <ProductList products={products || []} userId={user!.id} businessId={business?.id} config={config} />
        </div>
      )}

      {business?.type !== "kuliner" && (
        <>
          <TrendChart history={history || []} />
          <ProfitIndicator totalProfit={totalRealizedProfit} totalAssetValue={totalValue} />
          <LossBreakdownChart movements={(allMovements as never) || []} />
          <InventoryCharts products={products || []} />

          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl px-5 pt-4 pb-2 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Riwayat Stok — {months[bulan - 1]} {tahun}</h3>
              <Suspense><MonthYearFilter /></Suspense>
            </div>
          </div>

          <MovementsChart movements={(movements as never) || []} />
          <RecentMovements movements={(movements as never) || []} />
        </>
      )}
    </div>
  );
}
