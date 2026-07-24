import { createClient } from "@/lib/supabase/server";
import type { KasirTodaySummary } from "./owner-kasir-summary";
import type { LiveKasirRow } from "./owner-kasir-live";
import type { DayCloseData } from "@/app/dashboard/fnb/lib/day-close-types";
import { computeKasirKpis } from "@/app/dashboard/keuangan-bisnis/lib/kasir-kpis";
import { shortOrderNo } from "@/app/dashboard/fnb/lib/receipt-thermal";
import { parseMejaFromCatatan, mejaLabel } from "@/app/dashboard/fnb/lib/kasir-order-meta";
import OwnerClientLazy from "./owner-client-lazy";

import type { TopProduct, RecentTransaction } from "./owner-types";
export type { TopProduct, RecentTransaction };

const PRODUCT_EMOJI = ["🍜", "☕", "🧁", "🍱", "🥤", "🍕", "🥗", "🍰"];

export default async function DashboardOwnerPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const range = params.range || "month";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: businesses }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("id, name, type").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);
  const userName = profile?.full_name || user?.email?.split("@")[0] || "Owner";

  if (!businesses || businesses.length === 0) {
    return <div className="px-4 sm:px-8 py-8 text-[#8B8AA0]">Belum ada bisnis. Buat bisnis dulu di onboarding.</div>;
  }

  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  const today = now.toISOString().split("T")[0];
  const startOfYear = new Date(tahun, 0, 1).toISOString().split("T")[0];

  let periodStart: string;
  let periodEnd: string = today;
  let prevPeriodStart: string;
  let prevPeriodEnd: string;

  if (range === "today") {
    periodStart = today;
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    prevPeriodStart = yesterday.toISOString().split("T")[0];
    prevPeriodEnd = prevPeriodStart;
  } else if (range === "year") {
    periodStart = startOfYear;
    prevPeriodStart = new Date(tahun - 1, 0, 1).toISOString().split("T")[0];
    prevPeriodEnd = new Date(tahun - 1, 11, 31).toISOString().split("T")[0];
  } else if (range === "custom" && params.from && params.to) {
    periodStart = params.from;
    periodEnd = params.to;
    const fromDate = new Date(params.from);
    const toDate = new Date(params.to);
    const diffDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
    const prevTo = new Date(fromDate); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - diffDays);
    prevPeriodStart = prevFrom.toISOString().split("T")[0];
    prevPeriodEnd = prevTo.toISOString().split("T")[0];
  } else {
    periodStart = new Date(tahun, now.getMonth(), 1).toISOString().split("T")[0];
    prevPeriodStart = new Date(tahun, now.getMonth() - 1, 1).toISOString().split("T")[0];
    prevPeriodEnd = new Date(tahun, now.getMonth(), 0).toISOString().split("T")[0];
  }

  const startOfMonth = periodStart;
  const startOfLastMonth = prevPeriodStart;
  const endOfLastMonth = prevPeriodEnd;
  const bizIds = businesses.map(b => b.id);
  const pertanianIds = businesses.filter(b => b.type === "pertanian").map(b => b.id);
  const ternakIds = businesses.filter(b => b.type === "ternak").map(b => b.id);

  // Batch queries once for all businesses (avoids N× sequential roundtrips)
  const [
    { data: allMonthTx },
    { data: allLastMonthTx },
    { data: allYearTx },
    { data: allProducts },
    { data: allMonthOrders },
    { data: allTargets },
    { data: allDailyTx },
    { data: agriCosts },
    { data: agriSpray },
    { data: farmBatches },
  ] = await Promise.all([
    supabase.from("transactions").select("business_id, type, amount, category").in("business_id", bizIds).eq("scope", "bisnis").gte("transaction_date", startOfMonth).lte("transaction_date", periodEnd),
    supabase.from("transactions").select("business_id, type, amount").in("business_id", bizIds).eq("scope", "bisnis").gte("transaction_date", startOfLastMonth).lte("transaction_date", endOfLastMonth),
    supabase.from("transactions").select("business_id, type, amount").in("business_id", bizIds).eq("scope", "bisnis").gte("transaction_date", startOfYear),
    supabase.from("products").select("id, name, stock, min_stock, price, business_id").in("business_id", bizIds),
    supabase.from("orders").select("business_id, total, laba").in("business_id", bizIds).gte("order_date", startOfMonth).lte("order_date", periodEnd),
    supabase.from("business_targets").select("business_id, target_omzet").in("business_id", bizIds).eq("bulan", bulan).eq("tahun", tahun),
    supabase.from("transactions").select("business_id, transaction_date, amount").in("business_id", bizIds).eq("scope", "bisnis").eq("type", "pemasukan").gte("transaction_date", startOfMonth).lte("transaction_date", periodEnd),
    pertanianIds.length
      ? supabase.from("agri_production_costs").select("business_id, kategori, jumlah").in("business_id", pertanianIds).gte("tanggal", startOfMonth).lte("tanggal", periodEnd)
      : Promise.resolve({ data: [] as { business_id: string; kategori: string | null; jumlah: number | string }[] }),
    pertanianIds.length
      ? supabase.from("agri_spraying_records").select("business_id, biaya").in("business_id", pertanianIds).gte("tanggal", startOfMonth).lte("tanggal", periodEnd)
      : Promise.resolve({ data: [] as { business_id: string; biaya: number | string | null }[] }),
    ternakIds.length
      ? supabase.from("farm_batches").select("id, business_id").in("business_id", ternakIds)
      : Promise.resolve({ data: [] as { id: string; business_id: string }[] }),
  ]);

  const batchIds = (farmBatches || []).map(b => b.id);
  const { data: farmTx } = batchIds.length
    ? await supabase.from("farm_transactions").select("batch_id, jenis_transaksi, total").in("batch_id", batchIds).gte("tanggal", startOfMonth).lte("tanggal", periodEnd)
    : { data: [] as { batch_id: string; jenis_transaksi: string | null; total: number | string }[] };

  const businessData = businesses.map((biz) => {
    const monthTx = (allMonthTx || []).filter(t => t.business_id === biz.id);
    const lastMonthTx = (allLastMonthTx || []).filter(t => t.business_id === biz.id);
    const yearTx = (allYearTx || []).filter(t => t.business_id === biz.id);
    const products = (allProducts || []).filter(p => p.business_id === biz.id);
    const monthOrders = (allMonthOrders || []).filter(o => o.business_id === biz.id);
    const target = (allTargets || []).find(t => t.business_id === biz.id);

    const omzetFromTx = monthTx.filter(t => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0);
    let omzetBulan = omzetFromTx;
    let pengeluaranBulan = monthTx.filter(t => t.type === "pengeluaran").reduce((s, t) => s + Number(t.amount), 0);

    const pengeluaranByCategory: Record<string, number> = {};
    monthTx.filter(t => t.type === "pengeluaran").forEach(t => {
      const cat = t.category || "Lainnya";
      pengeluaranByCategory[cat] = (pengeluaranByCategory[cat] || 0) + Number(t.amount);
    });

    if (biz.type === "pertanian") {
      (agriCosts || []).filter(c => c.business_id === biz.id).forEach(c => {
        const amt = Number(c.jumlah);
        pengeluaranBulan += amt;
        const cat = c.kategori || "Biaya Pertanian";
        pengeluaranByCategory[cat] = (pengeluaranByCategory[cat] || 0) + amt;
      });
      (agriSpray || []).filter(s => s.business_id === biz.id).forEach(s => {
        const amt = Number(s.biaya || 0);
        pengeluaranBulan += amt;
        pengeluaranByCategory["Penyemprotan"] = (pengeluaranByCategory["Penyemprotan"] || 0) + amt;
      });
      const nilaiPanen = products.reduce((s, p) => s + (Number(p.price) || 0) * Number(p.stock), 0);
      if (omzetBulan === 0 && nilaiPanen > 0) omzetBulan = nilaiPanen;
    }

    if (biz.type === "ternak") {
      const bizBatchIds = new Set((farmBatches || []).filter(b => b.business_id === biz.id).map(b => b.id));
      (farmTx || []).filter(t => bizBatchIds.has(t.batch_id)).forEach(t => {
        const amt = Number(t.total);
        if (t.jenis_transaksi === "panen") {
          omzetBulan += amt;
        } else {
          pengeluaranBulan += amt;
          const cat = t.jenis_transaksi || "Operasional Ternak";
          pengeluaranByCategory[cat] = (pengeluaranByCategory[cat] || 0) + amt;
        }
      });
    }

    const labaBulan = omzetBulan - pengeluaranBulan;
    const omzetBulanLalu = lastMonthTx.filter(t => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0);
    const omzetTahun = yearTx.filter(t => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0);
    const stokKritis = products.filter(p => p.stock <= p.min_stock);
    const totalOrderBulan = monthOrders.length;
    const growthPct = omzetBulanLalu > 0 ? Math.round((omzetBulan - omzetBulanLalu) / omzetBulanLalu * 100) : 0;
    const targetOmzet = target?.target_omzet || 0;
    const targetPct = targetOmzet > 0 ? Math.round(omzetBulan / targetOmzet * 100) : 0;

    const dailyMap: Record<string, number> = {};
    (allDailyTx || []).filter(t => t.business_id === biz.id).forEach(t => {
      const d = t.transaction_date;
      dailyMap[d] = (dailyMap[d] || 0) + Number(t.amount);
    });

    return {
      id: biz.id, name: biz.name, type: biz.type,
      omzetBulan, labaBulan, omzetBulanLalu, omzetTahun, growthPct,
      totalOrderBulan, stokKritis, pengeluaranByCategory,
      targetOmzet, targetPct, dailyMap,
      margin: omzetBulan > 0 ? Math.round(labaBulan / omzetBulan * 100) : 0,
    };
  });

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("qty, harga_jual, menus(nama), orders!inner(business_id, order_date)")
    .in("orders.business_id", bizIds)
    .gte("orders.order_date", startOfMonth)
    .lte("orders.order_date", periodEnd);

  const productMap: Record<string, { name: string; sold: number; revenue: number }> = {};
  orderItems?.forEach(item => {
    const raw = item.menus as unknown;
    const menu = (Array.isArray(raw) ? raw[0] : raw) as { nama: string } | null | undefined;
    if (!menu?.nama) return;
    if (!productMap[menu.nama]) productMap[menu.nama] = { name: menu.nama, sold: 0, revenue: 0 };
    productMap[menu.nama].sold += Number(item.qty);
    productMap[menu.nama].revenue += Number(item.qty) * Number(item.harga_jual);
  });

  let topProducts: TopProduct[] = Object.entries(productMap)
    .map(([name, data], i) => ({
      id: name, name: data.name, sold: data.sold, revenue: data.revenue,
      emoji: PRODUCT_EMOJI[i % PRODUCT_EMOJI.length],
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (topProducts.length === 0) {
    const { data: allProducts } = await supabase
      .from("products").select("id, name, price, stock, business_id").in("business_id", bizIds).order("name").limit(20);
    topProducts = (allProducts || [])
      .map((p, i) => ({
        id: p.id,
        name: p.name,
        sold: Number(p.stock) || 0,
        revenue: Number(p.price || 0) * (Number(p.stock) || 1),
        emoji: PRODUCT_EMOJI[i % PRODUCT_EMOJI.length],
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  const { data: recentTxRaw } = await supabase
    .from("transactions")
    .select("id, amount, type, description, category, created_at, business_id")
    .in("business_id", bizIds)
    .eq("scope", "bisnis")
    .order("created_at", { ascending: false })
    .limit(6);

  let recentTransactions: RecentTransaction[] = (recentTxRaw || []).map(tx => {
    const created = tx.created_at ? new Date(tx.created_at) : new Date();
    const customer = tx.description?.split(",")[0]?.split(" x")[0] || tx.category || "Pelanggan";
    return {
      id: tx.id,
      customer: customer.length > 18 ? customer.slice(0, 18) + "…" : customer,
      status: tx.type === "pemasukan" ? "Selesai" : "Diproses",
      amount: Number(tx.amount),
      time: `${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`,
    };
  });

  if (recentTransactions.length < 6) {
    const { data: farmBatches } = await supabase.from("farm_batches").select("id, business_id").in("business_id", bizIds);
    const batchIds = farmBatches?.map(b => b.id) || [];
    if (batchIds.length > 0) {
      const { data: farmRecent } = await supabase
        .from("farm_transactions")
        .select("id, jenis_transaksi, total, tanggal, created_at")
        .in("batch_id", batchIds)
        .order("created_at", { ascending: false })
        .limit(6 - recentTransactions.length);
      farmRecent?.forEach(ft => {
        const created = ft.created_at ? new Date(ft.created_at) : new Date(ft.tanggal);
        recentTransactions.push({
          id: ft.id,
          customer: ft.jenis_transaksi || "Ternak",
          status: ft.jenis_transaksi === "panen" ? "Selesai" : "Diproses",
          amount: Number(ft.total),
          time: `${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`,
        });
      });
    }
  }

  let kasirSummary: KasirTodaySummary | null = null;
  let kasirBusinessName: string | undefined;
  let liveKasir: LiveKasirRow[] | null = null;
  let dayCloseData: DayCloseData | null = null;
  const activeKuliner = businesses.find(b => b.type === "kuliner");

  if (activeKuliner) {
    kasirBusinessName = activeKuliner.name;
    const [{ data: todayOrders }, { data: employees }, { data: ownerProfile }, { data: todayCheckins }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total, laba, diskon, metode_bayar, catatan, created_at, user_id, order_date, order_items(qty, menus(nama))")
        .eq("business_id", activeKuliner.id)
        .eq("order_date", today)
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id, nama").eq("business_id", activeKuliner.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("checkins")
        .select("employee_id, jam_masuk, jam_keluar")
        .eq("business_id", activeKuliner.id)
        .eq("tanggal", today),
    ]);

    const nameMap: Record<string, string> = { [user.id]: ownerProfile?.full_name || "Owner" };
    employees?.forEach(e => { nameMap[e.id] = e.nama; });

    const orders = todayOrders || [];
    const ordersByUser: Record<string, { count: number; omzet: number }> = {};
    orders.forEach(o => {
      const uid = o.user_id;
      if (!ordersByUser[uid]) ordersByUser[uid] = { count: 0, omzet: 0 };
      ordersByUser[uid].count++;
      ordersByUser[uid].omzet += Number(o.total || 0);
    });

    const checkinByEmp: Record<string, { jamMasuk: string; isActive: boolean }> = {};
    (todayCheckins || []).forEach(c => {
      const active = !c.jam_keluar;
      const prev = checkinByEmp[c.employee_id];
      if (!prev || active) {
        checkinByEmp[c.employee_id] = { jamMasuk: c.jam_masuk, isActive: active };
      }
    });

    const liveRows: LiveKasirRow[] = [];
    employees?.forEach(e => {
      const chk = checkinByEmp[e.id];
      const stats = ordersByUser[e.id];
      if (!chk && !stats) return;
      liveRows.push({
        employeeId: e.id,
        nama: e.nama,
        jamMasuk: chk?.jamMasuk ? String(chk.jamMasuk) : "—",
        orderCount: stats?.count || 0,
        omzet: stats?.omzet || 0,
        isActive: chk?.isActive || false,
      });
    });
    const ownerStats = ordersByUser[user.id];
    if (ownerStats) {
      liveRows.unshift({
        employeeId: user.id,
        nama: nameMap[user.id] || "Owner",
        jamMasuk: "—",
        orderCount: ownerStats.count,
        omzet: ownerStats.omzet,
        isActive: false,
      });
    }
    liveKasir = liveRows.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.omzet - a.omzet);

    const mapOrderItems = (o: (typeof orders)[0]) => {
      const items = (o.order_items || []) as { qty: number; menus: { nama: string } | { nama: string }[] | null }[];
      return items.map(i => {
        const m = i.menus;
        const nama = Array.isArray(m) ? m[0]?.nama : m?.nama;
        return `${nama || "Menu"} x${i.qty}`;
      }).join(", ");
    };

    kasirSummary = {
      omzetHariIni: orders.reduce((s, o) => s + Number(o.total || 0), 0),
      labaHariIni: orders.reduce((s, o) => s + Number(o.laba || 0), 0),
      orderHariIni: orders.length,
      recentOrders: orders.slice(0, 8).map(o => {
        const parsed = parseMejaFromCatatan(o.catatan);
        return {
          id: o.id,
          total: Number(o.total),
          created_at: o.created_at,
          kasirName: nameMap[o.user_id] || "Kasir",
          itemsSummary: mapOrderItems(o),
          mejaLabel: mejaLabel(parsed.meja),
          catatan: parsed.note,
        };
      }),
    };

    const exportOrders = orders.map(o => ({
      id: o.id,
      orderNo: shortOrderNo(o.id),
      kasirName: nameMap[o.user_id] || "Kasir",
      order_date: o.order_date,
      created_at: o.created_at,
      metode_bayar: o.metode_bayar,
      catatan: o.catatan,
      diskon: o.diskon,
      total: Number(o.total),
      laba: o.laba,
      itemsSummary: mapOrderItems(o),
    }));

    dayCloseData = {
      businessName: activeKuliner.name,
      tanggal: today,
      orders: exportOrders,
      kpis: computeKasirKpis(exportOrders),
      activeKasir: liveRows.filter(r => r.isActive).map(r => ({
        nama: r.nama,
        jamMasuk: r.jamMasuk,
        orderCount: r.orderCount,
        omzet: r.omzet,
      })),
    };
  }

  return (
    <OwnerClientLazy
      businesses={JSON.parse(JSON.stringify(businessData))}
      topProducts={JSON.parse(JSON.stringify(topProducts))}
      recentTransactions={JSON.parse(JSON.stringify(recentTransactions))}
      kasirSummary={kasirSummary ? JSON.parse(JSON.stringify(kasirSummary)) : null}
      kasirBusinessName={kasirBusinessName}
      liveKasir={liveKasir ? JSON.parse(JSON.stringify(liveKasir)) : null}
      dayCloseData={dayCloseData ? JSON.parse(JSON.stringify(dayCloseData)) : null}
      bulan={bulan}
      tahun={tahun}
      userId={user.id}
      userName={userName}
    />
  );
}
