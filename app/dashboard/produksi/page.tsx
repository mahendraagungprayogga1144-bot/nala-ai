import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getConfig } from "../inventory/business-config";
import RecipeList from "./recipe-list";
import ProductionForm from "./production-form";
import { Package, Wallet, TrendingUp, BarChart3 } from "lucide-react";
import HomeIndustryHubNav from "../inventory/home-industry-hub-nav";
import { todayWib } from "../inventory/home-industry-calc";

export default async function ProduksiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name").eq("user_id", user!.id).order("created_at", { ascending: true });

  const business = businessData?.find((b) => b.id === activeBusinessId) || businessData?.[0] || null;
  const config = getConfig(business?.type);

  const { data: materials } = await supabase
    .from("products").select("id, name, stock, cost, category")
    .eq("business_id", business?.id || "").order("name");

  const { data: finishedProducts } = await supabase
    .from("products").select("id, name, stock, price, cost, category")
    .eq("business_id", business?.id || "").order("name");

  const { data: recipes } = await supabase
    .from("recipes").select("*, recipe_ingredients(*, products(name, cost, stock))")
    .eq("business_id", business?.id || "").order("created_at", { ascending: false });

  const { data: productionLogs } = await supabase
    .from("production_logs").select("*, recipes(name, yield_unit)")
    .eq("business_id", business?.id || "").order("production_date", { ascending: false });

  const { data: salesData } = await supabase
    .from("stock_movements").select("quantity, profit_loss, movement_date, products(name)")
    .eq("user_id", user!.id).eq("type", "keluar").eq("reason", "dijual")
    .order("movement_date", { ascending: false }).limit(20);

  const totalProduksi = productionLogs?.length || 0;
  const totalBiayaProduksi = productionLogs?.reduce((s, l) => s + Number(l.total_material_cost || 0), 0) || 0;
  const totalProdukJadi = productionLogs?.filter(l => l.status === "selesai").reduce((s, l) => s + Number(l.quantity_produced || 0), 0) || 0;

  let totalLaba = salesData?.reduce((s, m) => s + Number(m.profit_loss || 0), 0) || 0;
  let labaLabel = "Total Laba";

  if (business?.type === "homeindustry" && business.id) {
    const today = todayWib();
    const { data: todayTx } = await supabase
      .from("transactions")
      .select("type, category, amount")
      .eq("business_id", business.id)
      .eq("transaction_date", today);
    const penjualan = (todayTx || [])
      .filter(t => t.type === "pemasukan" && (t.category === "Penjualan" || t.category === "Penjualan Produk"))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const hpp = (todayTx || [])
      .filter(t => t.type === "pengeluaran" && t.category === "HPP")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    totalLaba = penjualan - hpp;
    labaLabel = "Profit Hari Ini";
  }

  const kpis = [
    { label: "Total Produksi", value: totalProduksi, icon: Package, color: "#38BDF8" },
    { label: "Total Biaya", value: `Rp${totalBiayaProduksi.toLocaleString("id-ID")}`, icon: Wallet, color: "#EC4899" },
    { label: "Produk Jadi", value: totalProdukJadi, icon: BarChart3, color: "#2DD4BF" },
    { label: labaLabel, value: `Rp${totalLaba.toLocaleString("id-ID")}`, icon: TrendingUp, color: "#8B5CF6" },
  ];

  const STATUS_COLOR: Record<string, string> = { draft: "#8B8AA0", diproses: "#F59E0B", selesai: "#2DD4BF" };

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Produksi</h1>
        {business?.name && <span className="text-xs text-[#8B8AA0] bg-white/5 px-3 py-1 rounded-full">{business.name}</span>}
      </div>
      <p className="text-[#8B8AA0] mb-6">
        {business?.type === "homeindustry"
          ? "Buat resep, catat produksi, lalu jual produk jadi di Stok & Penjualan."
          : "Kelola resep, produksi, dan hitung HPP otomatis."}
      </p>

      {business?.type === "homeindustry" && <HomeIndustryHubNav />}

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

      <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mb-6">
        <h2 className="text-xs font-semibold text-[#8B8AA0] uppercase tracking-widest mb-3">Cara pakai</h2>
        <ol className="text-sm text-[#8B8AA0] flex flex-col gap-2">
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] text-xs flex items-center justify-center flex-shrink-0">1</span>Beli bahan baku → masuk <a href="/dashboard/inventory" className="text-[#38BDF8] underline">Inventory</a></li>
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs flex items-center justify-center flex-shrink-0">2</span>Buat resep + daftar bahan</li>
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#2DD4BF]/20 text-[#2DD4BF] text-xs flex items-center justify-center flex-shrink-0">3</span>Catat produksi → stok bahan berkurang, HPP dihitung otomatis</li>
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#EC4899]/20 text-[#EC4899] text-xs flex items-center justify-center flex-shrink-0">4</span>
            {business?.type === "homeindustry"
              ? <>Set status Selesai → jual di <a href="/dashboard/inventory" className="text-[#2DD4BF] underline">Stok & Penjualan</a> (tombol Jual)</>
              : <>Set status Selesai → produk jadi otomatis masuk Inventory</>}
          </li>
        </ol>
      </div>

      <RecipeList recipes={(recipes as never) || []} materials={materials || []} finishedProducts={finishedProducts || []} userId={user!.id} businessId={business?.id} config={config} />

      {(recipes?.length || 0) > 0 && (
        <ProductionForm recipes={(recipes as never) || []} userId={user!.id} businessId={business?.id} />
      )}

      {(productionLogs?.length || 0) > 0 && (
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mt-6">
          <h2 className="font-medium mb-4">Riwayat Produksi</h2>
          <div className="flex flex-col gap-3">
            {productionLogs?.map((log) => {
              const recipe = log.recipes as never as { name: string; yield_unit: string };
              const statusColor = STATUS_COLOR[log.status || "draft"];
              return (
                <div key={log.id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{recipe?.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: statusColor, borderColor: statusColor + "40", background: statusColor + "15" }}>
                        {log.status || "draft"}
                      </span>
                    </div>
                    <p className="text-xs text-[#8B8AA0]">
                      {log.quantity_produced} {recipe?.yield_unit} · HPP Rp{Math.round(Number(log.hpp_per_unit || 0)).toLocaleString("id-ID")}/{recipe?.yield_unit} · {new Date(log.production_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-[#EC4899]">-Rp{Number(log.total_material_cost).toLocaleString("id-ID")}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
