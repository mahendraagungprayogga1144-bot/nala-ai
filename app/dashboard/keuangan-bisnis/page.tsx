import { createClient } from "@/lib/supabase/server";
import TransactionForm from "../transaction-form";
import DeleteTransactionButton from "../delete-transaction-button";
import MonthYearFilter from "../month-year-filter";
import { Suspense, Fragment } from "react";
import { cookies } from "next/headers";
import { sortBisnisTransactions, formatTxDateLabel, formatTxTimeWib } from "@/lib/finance/sort-transactions";
import KasirTransactionsPanel, { type KasirOrderRow } from "./kasir-transactions-panel";
import CashFlowChartLazy from "../cash-flow-chart-lazy";
import { guardPage } from "../lib/page-guard";
import { monthEndYmd, monthStartYmd } from "@/lib/date";
import { normalizeBizType } from "@/lib/auth/post-login";

type OrderItemRow = {
  qty: number;
  harga_jual: number;
  menu_id?: string | null;
  menus?: { nama: string } | { nama: string }[] | null;
};

async function loadKasirOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<KasirOrderRow[]> {
  const orderSelect =
    "id, user_id, total, diskon, laba, metode_bayar, catatan, order_date, created_at, order_items(qty, harga_jual, menu_id, menus(nama))";
  const orderSelectFallback =
    "id, user_id, total, diskon, laba, metode_bayar, catatan, order_date, created_at, order_items(qty, harga_jual, menu_id)";

  type RawOrder = {
    id: string;
    user_id: string;
    total: number;
    diskon: number | null;
    laba: number | null;
    metode_bayar: string | null;
    catatan: string | null;
    order_date: string;
    created_at: string;
    order_items?: OrderItemRow[] | null;
  };

  const [{ data: orderRows, error: orderErr }, { data: employees }, { data: profile }] = await Promise.all([
    supabase
      .from("orders")
      .select(orderSelect)
      .eq("business_id", businessId)
      .gte("order_date", startDate)
      .lte("order_date", endDate)
      .order("created_at", { ascending: false }),
    supabase.from("employees").select("id, nama").eq("business_id", businessId),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  let rows: RawOrder[] = (orderRows || []) as RawOrder[];
  if (orderErr) {
    console.error("[keuangan-bisnis/orders]", orderErr.message);
    // Fallback when PostgREST has no order_items→menus FK yet.
    const { data: fallbackRows, error: fallbackErr } = await supabase
      .from("orders")
      .select(orderSelectFallback)
      .eq("business_id", businessId)
      .gte("order_date", startDate)
      .lte("order_date", endDate)
      .order("created_at", { ascending: false });
    if (fallbackErr) {
      console.error("[keuangan-bisnis/orders-fallback]", fallbackErr.message);
      return [];
    }
    rows = (fallbackRows || []) as RawOrder[];

    const menuIds = new Set<string>();
    for (const o of rows) {
      for (const item of o.order_items || []) {
        if (item.menu_id) menuIds.add(item.menu_id);
      }
    }
    const menuMap: Record<string, string> = {};
    if (menuIds.size > 0) {
      const { data: menus } = await supabase.from("menus").select("id, nama").in("id", [...menuIds]);
      menus?.forEach((m) => { menuMap[m.id] = m.nama; });
    }
    rows = rows.map((o) => ({
      ...o,
      order_items: (o.order_items || []).map((item) => ({
        ...item,
        menus: item.menu_id && menuMap[item.menu_id] ? { nama: menuMap[item.menu_id] } : null,
      })),
    }));
  }

  const kasirNames: Record<string, string> = { [userId]: profile?.full_name || "Owner" };
  employees?.forEach((e) => { kasirNames[e.id] = e.nama; });
  return rows.map((o) => ({
    id: o.id,
    user_id: o.user_id,
    total: o.total,
    diskon: o.diskon,
    laba: o.laba,
    metode_bayar: o.metode_bayar,
    catatan: o.catatan,
    order_date: o.order_date,
    created_at: o.created_at,
    order_items: (o.order_items || []).map((item) => ({
      qty: item.qty,
      harga_jual: item.harga_jual,
      menus: item.menus ?? null,
    })),
    kasirName: kasirNames[o.user_id] || "Kasir",
  }));
}

export default async function KeuanganBisnisPage({ searchParams }: { searchParams: Promise<{ bulan?: string; tahun?: string }> }) {
  return guardPage("Keuangan Bisnis", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const params = await searchParams;

  const now = new Date();
  const bulan = Number(params.bulan) || now.getMonth() + 1;
  const tahun = Number(params.tahun) || now.getFullYear();

  const startDate = monthStartYmd(tahun, bulan);
  const endDate = monthEndYmd(tahun, bulan);

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;
  const { data: businessData } = await supabase.from("businesses").select("id, name, type").eq("user_id", user.id).order("created_at", { ascending: true });
  const rawBiz = businessData?.find((b) => b.id === activeBusinessId) || businessData?.[0] || null;
  const business = rawBiz ? { ...rawBiz, type: normalizeBizType(rawBiz.type) } : null;

  let kasirOrders: KasirOrderRow[] = [];
  if (business?.type === "kuliner" && business.id) {
    try {
      kasirOrders = await loadKasirOrders(supabase, business.id, user.id, startDate, endDate);
    } catch (err) {
      console.error("[keuangan-bisnis/orders]", err);
    }
  }

  const yearStart = `${tahun}-01-01`;
  let allQuery = supabase
    .from("transactions")
    .select("id, type, amount, category, description, transaction_date, created_at, business_id")
    .eq("scope", "bisnis")
    .eq("user_id", user.id)
    .gte("transaction_date", yearStart)
    .limit(5000);
  if (business?.id) allQuery = allQuery.eq("business_id", business.id);
  const { data: allTransactions } = await allQuery;

  let monthQuery = supabase
    .from("transactions")
    .select("id, type, amount, category, description, transaction_date, created_at, business_id")
    .eq("scope", "bisnis")
    .eq("user_id", user.id)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .limit(2000);
  if (business?.id) monthQuery = monthQuery.eq("business_id", business.id);
  const { data: monthRows } = await monthQuery
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  const transactions = sortBisnisTransactions(monthRows || []);

  const totalIncome = allTransactions?.filter((t) => t.type === "pemasukan").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalExpense = allTransactions?.filter((t) => t.type === "pengeluaran").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalBalance = totalIncome - totalExpense;

  const monthIncome = transactions?.filter((t) => t.type === "pemasukan").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const monthExpense = transactions?.filter((t) => t.type === "pengeluaran").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8">
      <h1 className="text-2xl font-semibold mb-1">Keuangan Bisnis</h1>
      <p className="text-[#8B8AA0] mb-6">
        Penjualan, modal, operasional{business?.name ? ` · ${business.name}` : ""}
        {business?.type === "kuliner" ? " · termasuk transaksi kasir di bawah" : ""}.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-[#8B8AA0] mb-1">Total Saldo</p>
          <p className="text-xl font-mono font-semibold">Rp{totalBalance.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[#5A5B6A] mt-1">{business?.name || "Bisnis aktif"}</p>
        </div>
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-[#8B8AA0] mb-1">Pemasukan {months[bulan - 1]}</p>
          <p className="text-xl font-mono font-semibold text-[#2DD4BF]">Rp{monthIncome.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[#5A5B6A] mt-1">{months[bulan - 1]} {tahun}</p>
        </div>
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-[#8B8AA0] mb-1">Pengeluaran {months[bulan - 1]}</p>
          <p className="text-xl font-mono font-semibold text-[#EC4899]">Rp{monthExpense.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[#5A5B6A] mt-1">{months[bulan - 1]} {tahun}</p>
        </div>
      </div>

      <Suspense><MonthYearFilter /></Suspense>

      <CashFlowChartLazy title="Tren Saldo Bisnis" transactions={(transactions as never) || []} />

      {business?.type === "kuliner" && (
        <KasirTransactionsPanel
          orders={kasirOrders}
          monthLabel={`${months[bulan - 1]} ${tahun}`}
          businessName={business.name}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
        <TransactionForm userId={user.id} scope="bisnis" businessId={business?.id} />
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
          <h2 className="font-medium mb-1">Transaksi {months[bulan - 1]} {tahun}</h2>
          <p className="text-[10px] text-[#5A5B7A] mb-4">Terbaru di atas · grup jual & HPP berdampingan</p>
          <div className="flex flex-col gap-3">
            {transactions.length > 0 ? (
              transactions.map((t, i) => {
                const dateKey = (t.transaction_date || t.created_at || "").slice(0, 10);
                const prevKey = i > 0
                  ? (transactions[i - 1].transaction_date || transactions[i - 1].created_at || "").slice(0, 10)
                  : null;
                return (
                  <Fragment key={t.id}>
                    {dateKey !== prevKey && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5A5B7A] pt-1">
                        {formatTxDateLabel(dateKey)}
                      </p>
                    )}
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium">{t.description || t.category || "Transaksi"}</p>
                          {t.category === "Penjualan F&B" && (
                            <span className="rounded-md bg-[#2DD4BF]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#2DD4BF]">Kasir</span>
                          )}
                        </div>
                        <p className="text-xs text-[#8B8AA0]">
                          {t.category}
                          <span className="mx-1.5">·</span>
                          {formatTxTimeWib(t.created_at)} WIB
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={"font-mono text-sm font-medium " + (t.type === "pemasukan" ? "text-[#2DD4BF]" : "text-[#EC4899]")}>
                          {t.type === "pemasukan" ? "+" : "-"}Rp{Number(t.amount).toLocaleString("id-ID")}
                        </p>
                        <DeleteTransactionButton id={t.id} />
                      </div>
                    </div>
                  </Fragment>
                );
              })
            ) : (
              <p className="text-sm text-[#8B8AA0]">Belum ada transaksi di {months[bulan - 1]} {tahun}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  });
}
