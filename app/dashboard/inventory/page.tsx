import { createClient } from "@/lib/supabase/server";
import ProductForm from "./product-form";
import ProductList from "./product-list";
import ProfitIndicator from "./profit-indicator";
import MonthYearFilter from "../month-year-filter";
import { Package, AlertTriangle, Wallet, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { getConfig } from "./business-config";
import type { HiRecipe } from "./home-industry-calc";
import { todayWib } from "./home-industry-calc";
import { normalizeBizType } from "@/lib/auth/post-login";
import {
  InventoryChartsLazy,
  TrendChartLazy,
  RecentMovementsLazy,
  MovementsChartLazy,
  LossBreakdownChartLazy,
} from "./inventory-charts-lazy";
import {
  LivestockInventoryLazy,
  HomeIndustryInventoryLazy,
  FnBInventoryLazy,
  AgricultureInventoryLazy,
  RetailInventoryLazy,
  JasaInventoryLazy,
  WholesaleInventoryLazy,
  OlshopInventoryLazy,
  KesehatanInventoryLazy,
  BengkelInventoryLazy,
} from "./inventory-panels-lazy";

const DISTINCT_INVENTORY_TYPES = ["retail", "jasa", "wholesale", "olshop", "kesehatan", "bengkel"];

export default async function InventoryPage(props: { searchParams: Promise<{ bulan?: string; tahun?: string }> }) {
  try {
    return await InventoryPageInner(props);
  } catch (err) {
    unstable_rethrow(err);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[inventory]", err);
    return (
      <div className="px-4 py-10 text-center sm:px-8">
        <p className="mb-2 text-[#EC4899]">Inventory error</p>
        <p className="break-words font-mono text-xs text-[#8B8AA0]">{message}</p>
      </div>
    );
  }
}

async function InventoryPageInner({ searchParams }: { searchParams: Promise<{ bulan?: string; tahun?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const raw = businessData?.find((b) => b.id === activeBusinessId) || businessData?.[0] || null;
  const business = raw
    ? { ...raw, type: raw.type ? normalizeBizType(raw.type) : raw.type }
    : null;
  const config = getConfig(business?.type);

  const { data: productRowsRaw, error: productsErr } = await supabase
    .from("products")
    .select("id, name, sku, stock, min_stock, price, cost, category, photo_url, unit, business_id, user_id, created_at")
    .eq("business_id", business?.id || "")
    .order("name", { ascending: true })
    .limit(2000);

  // Fallback if some columns missing on older DBs
  let productRows = productRowsRaw;
  let loadErr = productsErr;
  if (productsErr?.message?.includes("does not exist")) {
    const retry = await supabase
      .from("products")
      .select("id, name, sku, stock, min_stock, price, cost, category, business_id, user_id")
      .eq("business_id", business?.id || "")
      .order("name", { ascending: true })
      .limit(2000);
    productRows = retry.data as typeof productRowsRaw;
    loadErr = retry.error;
  }

  if (loadErr) {
    return (
      <div className="px-4 py-10 text-center sm:px-8">
        <p className="mb-2 text-[#EC4899]">Gagal memuat inventory.</p>
        <p className="text-xs text-[#8B8AA0]">{loadErr.message}</p>
      </div>
    );
  }

  const products = (productRows || []).map((p) => ({
    ...p,
    photo_url: (p as { photo_url?: string | null }).photo_url ?? null,
    unit: (p as { unit?: string | null }).unit ?? null,
    created_at: (p as { created_at?: string }).created_at ?? new Date().toISOString(),
  }));

  const today = todayWib();
  let homeRecipes: HiRecipe[] = [];
  let profitHariIni = 0;
  let penjualanHariIni = 0;
  let hppHariIni = 0;
  let todaySales: { description: string | null; amount: number }[] = [];
  let productAttrs: { product_id: string; expiry_date?: string | null; min_order_qty?: number | null; wholesale_price?: number | null }[] = [];

  if (business?.type === "homeindustry" && business.id) {
    const [{ data: recipesData }, { data: todayTx }, { data: salesData }] = await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, yield_quantity, recipe_ingredients(quantity, products(name, cost))")
        .eq("business_id", business.id),
      supabase
        .from("transactions")
        .select("type, category, amount, description")
        .eq("business_id", business.id)
        .eq("transaction_date", today),
      supabase
        .from("transactions")
        .select("description, amount")
        .eq("business_id", business.id)
        .eq("transaction_date", today)
        .eq("type", "pemasukan")
        .eq("category", "Penjualan")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    homeRecipes = (recipesData || []) as unknown as HiRecipe[];
    todaySales = salesData || [];
    penjualanHariIni = (todayTx || [])
      .filter(t => t.type === "pemasukan" && (t.category === "Penjualan" || t.category === "Penjualan Produk"))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    hppHariIni = (todayTx || [])
      .filter(t => t.type === "pengeluaran" && t.category === "HPP")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    profitHariIni = penjualanHariIni - hppHariIni;
  }

  let harvestMeta: { product_id: string; satuan: string | null }[] = [];
  let saprotanMeta: { product_id: string; satuan: string | null }[] = [];
  let agriBiayaProduksi = 0;
  let agriBiayaSemprot = 0;
  let agriProfitHariIni = 0;
  let agriPenjualanHariIni = 0;
  let agriHppHariIni = 0;
  let agriTodaySales: { description: string | null; amount: number }[] = [];

  if (business?.type === "pertanian" && business.id) {
    const [{ data: hm }, { data: sm }, { data: costs }, { data: spray }, { data: todayTx }, { data: salesData }] = await Promise.all([
      supabase.from("agri_harvest_meta").select("product_id, satuan").eq("business_id", business.id),
      supabase.from("agri_saprotan_meta").select("product_id, satuan").eq("business_id", business.id),
      supabase.from("agri_production_costs").select("jumlah").eq("business_id", business.id),
      supabase.from("agri_spraying_records").select("biaya").eq("business_id", business.id),
      supabase.from("transactions").select("type, category, amount, description").eq("business_id", business.id).eq("transaction_date", today),
      supabase.from("transactions").select("description, amount").eq("business_id", business.id).eq("transaction_date", today).eq("type", "pemasukan").eq("category", "Penjualan Panen").order("created_at", { ascending: false }).limit(5),
    ]);
    harvestMeta = hm || [];
    saprotanMeta = sm || [];
    agriBiayaProduksi = (costs || []).reduce((s, c) => s + Number(c.jumlah || 0), 0);
    agriBiayaSemprot = (spray || []).reduce((s, r) => s + Number(r.biaya || 0), 0);
    agriTodaySales = salesData || [];
    agriPenjualanHariIni = (todayTx || []).filter(t => t.type === "pemasukan" && t.category === "Penjualan Panen").reduce((s, t) => s + Number(t.amount || 0), 0);
    // HPP tidak lagi di-double-book ke keuangan; profit hari ini = omzet panen (biaya sudah tercatat saat input)
    agriHppHariIni = 0;
    agriProfitHariIni = agriPenjualanHariIni;
  }

  if ((business?.type === "kesehatan" || business?.type === "wholesale") && business.id) {
    const { data: attrs } = await supabase
      .from("module_product_attrs")
      .select("product_id, expiry_date, min_order_qty, wholesale_price")
      .eq("business_id", business.id);
    productAttrs = attrs || [];
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
        .gte("movement_date", startDate)
        .lte("movement_date", endDate)
        .limit(5000)
    : Promise.resolve({ data: [] as never[] });

  const [{ data: movements }, { data: allMovements }] = await Promise.all([movementsQuery, allMovementsQuery]);

  const totalRealizedProfit = allMovements?.reduce((sum, m) => sum + Number(m.profit_loss || 0), 0) || 0;
  const totalProducts = products?.length || 0;
  const lowStockCount = products?.filter((p) => p.stock <= p.min_stock).length || 0;
  const totalValue = products?.reduce((sum, p) => sum + (p.price || 0) * p.stock, 0) || 0;
  const avgPrice = totalProducts > 0 ? ((products || []).reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts) : 0;

  const specialized =
    business?.type === "kuliner" ||
    business?.type === "homeindustry" ||
    business?.type === "pertanian" ||
    business?.type === "ternak" ||
    DISTINCT_INVENTORY_TYPES.includes(business?.type || "");
  const isDistinct = DISTINCT_INVENTORY_TYPES.includes(business?.type || "");

  let history: { snapshot_date: string; total_value: number }[] | null = null;
  if (!specialized) {
    await supabase.from("inventory_history").upsert(
      { user_id: user.id, business_id: business?.id, snapshot_date: todayWib(), total_value: totalValue },
      { onConflict: "user_id,snapshot_date" }
    );
    const { data: hist } = await supabase
      .from("inventory_history")
      .select("snapshot_date, total_value")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: true })
      .limit(30);
    history = hist;
  }

  const kpis = [
    { label: config.kpiLabel.total, value: totalProducts, icon: Package, color: "#38BDF8" },
    { label: config.kpiLabel.lowStock, value: lowStockCount, icon: AlertTriangle, color: "#EC4899" },
    { label: config.kpiLabel.nilai, value: `Rp${totalValue.toLocaleString("id-ID")}`, icon: Wallet, color: "#2DD4BF" },
    { label: config.kpiLabel.rataHarga, value: `Rp${Math.round(avgPrice).toLocaleString("id-ID")}`, icon: TrendingUp, color: "#8B5CF6" },
  ];

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {business?.type === "kuliner" ? "Stok Bahan"
            : business?.type === "homeindustry" ? "Stok & Penjualan"
            : business?.type === "pertanian" ? "Stok & Jual Panen"
            : business?.type === "ternak" ? "Stok Ternak"
            : business?.type === "retail" ? "Stok Toko"
            : business?.type === "jasa" ? "Aset & Peralatan"
            : business?.type === "wholesale" ? "Stok Grosir"
            : business?.type === "olshop" ? "Stok Online"
            : business?.type === "kesehatan" ? "Stok Obat & Alkes"
            : business?.type === "bengkel" ? "Spare Part"
            : "Inventory"}
        </h1>
        {business?.name && <span className="text-xs text-[#8B8AA0] bg-white/5 px-3 py-1 rounded-full">{business.name}</span>}
      </div>
      {business?.type === "kuliner" ? (
        <p className="mb-3 hidden text-sm text-[#8B8AA0] sm:mb-4 sm:block">Stok bahan → buat menu + resep → jual di kasir. Stok otomatis berkurang.</p>
      ) : business?.type === "homeindustry" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok bahan → produksi + resep → jual produk jadi. HPP & profit otomatis.</p>
      ) : business?.type === "pertanian" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Gudang panen & saprotan — Masuk/Keluar/Jual. Biaya produksi di Modul Pertanian.</p>
      ) : business?.type === "ternak" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok hewan & pakan — catat batch & P&L di Manajemen Ternak.</p>
      ) : business?.type === "retail" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok toko fisik. Lihat ringkasan di <a href="/dashboard/retail" className="text-[#2DD4BF] hover:underline">Pusat Retail</a>.</p>
      ) : business?.type === "jasa" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Aset/peralatan. Order klien & fee di <a href="/dashboard/jasa" className="text-[#2DD4BF] hover:underline">Order Jasa</a>.</p>
      ) : business?.type === "wholesale" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok partai. Set harga grosir & MOQ di <a href="/dashboard/wholesale" className="text-[#2DD4BF] hover:underline">Pusat Grosir</a>.</p>
      ) : business?.type === "olshop" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok online. Marketplace & laporan di <a href="/dashboard/olshop" className="text-[#2DD4BF] hover:underline">Pusat Online Shop</a>.</p>
      ) : business?.type === "kesehatan" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Stok obat/alkes. Pantau kadaluarsa di <a href="/dashboard/kesehatan" className="text-[#2DD4BF] hover:underline">Pusat Kesehatan</a>.</p>
      ) : business?.type === "bengkel" ? (
        <p className="text-[#8B8AA0] mb-4 text-sm">Spare part. Antrian servis di <a href="/dashboard/bengkel" className="text-[#2DD4BF] hover:underline">Antrian Bengkel</a>.</p>
      ) : (
        <p className="text-[#8B8AA0] mb-8">{config.produkLabel} dan stok kamu.</p>
      )}

      {business?.type !== "homeindustry" && business?.type !== "ternak" && business?.type !== "kuliner" && business?.type !== "pertanian" && !isDistinct && (
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
          <LivestockInventoryLazy products={products || []} userId={user.id} businessId={business?.id} />
        </div>
      ) : business?.type === "homeindustry" ? (
        <div className="mb-8">
          <HomeIndustryInventoryLazy
            products={products || []}
            recipes={homeRecipes || []}
            userId={user.id}
            businessId={business?.id}
            profitHariIni={profitHariIni}
            penjualanHariIni={penjualanHariIni}
            hppHariIni={hppHariIni}
            todaySales={todaySales}
            today={today}
          />
        </div>
      ) : business?.type === "kuliner" ? (
        <div className="mb-8">
          <FnBInventoryLazy products={products || []} userId={user.id} businessId={business?.id} businessName={business?.name} />
        </div>
      ) : business?.type === "pertanian" ? (
        <div className="mb-8">
          <AgricultureInventoryLazy
            products={products || []}
            harvestMeta={harvestMeta as never}
            userId={user.id}
            businessId={business?.id}
            totalBiayaProduksi={agriBiayaProduksi}
            totalBiayaSemprot={agriBiayaSemprot}
            profitHariIni={agriProfitHariIni}
            penjualanHariIni={agriPenjualanHariIni}
            hppHariIni={agriHppHariIni}
            todaySales={agriTodaySales}
            today={today}
            movements={(movements as never) || []}
          />
        </div>
      ) : business?.type === "retail" ? (
        <div className="mb-8">
          <RetailInventoryLazy products={products || []} userId={user.id} businessId={business?.id} movements={(movements as never) || []} />
        </div>
      ) : business?.type === "jasa" ? (
        <div className="mb-8">
          <JasaInventoryLazy products={products || []} userId={user.id} businessId={business?.id} movements={(movements as never) || []} />
        </div>
      ) : business?.type === "wholesale" ? (
        <div className="mb-8">
          <WholesaleInventoryLazy products={products || []} userId={user.id} businessId={business?.id} attrs={productAttrs} movements={(movements as never) || []} />
        </div>
      ) : business?.type === "olshop" ? (
        <div className="mb-8">
          <OlshopInventoryLazy products={products || []} userId={user.id} businessId={business?.id} movements={(movements as never) || []} />
        </div>
      ) : business?.type === "kesehatan" ? (
        <div className="mb-8">
          <KesehatanInventoryLazy products={products || []} userId={user.id} businessId={business?.id} attrs={productAttrs} movements={(movements as never) || []} />
        </div>
      ) : business?.type === "bengkel" ? (
        <div className="mb-8">
          <BengkelInventoryLazy products={products || []} userId={user.id} businessId={business?.id} movements={(movements as never) || []} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 mb-8">
          <ProductForm userId={user.id} businessId={business?.id} nextSkuNumber={totalProducts + 1} config={config} />
          <ProductList products={products || []} userId={user.id} businessId={business?.id} config={config} />
        </div>
      )}

      {!specialized && (
        <>
          <TrendChartLazy history={history || []} />
          <ProfitIndicator totalProfit={totalRealizedProfit} totalAssetValue={totalValue} />
          <LossBreakdownChartLazy movements={(allMovements as never) || []} />
          <InventoryChartsLazy products={products || []} />

          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl px-5 pt-4 pb-2 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Riwayat Stok — {months[bulan - 1]} {tahun}</h3>
              <Suspense><MonthYearFilter /></Suspense>
            </div>
          </div>

          <MovementsChartLazy movements={(movements as never) || []} />
          <RecentMovementsLazy movements={(movements as never) || []} />
        </>
      )}
    </div>
  );
}
