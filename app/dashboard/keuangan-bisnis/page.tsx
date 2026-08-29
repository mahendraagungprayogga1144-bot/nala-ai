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
import { bizTypeLabel } from "@/lib/finance/biz-type-label";
import BusinessFinanceFilter from "./business-finance-filter";

type OrderItemRow = {
  qty: number;
  harga_jual: number;
  menu_id?: string | null;
  menus?: { nama: string } | { nama: string }[] | null;
};

type BizRow = { id: string; name: string; type: string | null };

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
      .or("source.is.null,source.neq.henima_sales")
      .gte("order_date", startDate)
      .lte("order_date", endDate)
      .order("created_at", { ascending: false }),
    supabase.from("employees").select("id, nama").eq("business_id", businessId),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  let rows: RawOrder[] = (orderRows || []) as RawOrder[];
  if (orderErr) {
    console.error("[keuangan-bisnis/orders]", orderErr.message);
    const { data: fallbackRows, error: fallbackErr } = await supabase
      .from("orders")
      .select(orderSelectFallback)
      .eq("business_id", businessId)
      .or("source.is.null,source.neq.henima_sales")
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
      menus?.forEach((m) => {
        menuMap[m.id] = m.nama;
      });
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
  employees?.forEach((e) => {
    kasirNames[e.id] = e.nama;
  });
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

export default async function KeuanganBisnisPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; bisnis?: string }>;
}) {
  return guardPage("Keuangan Bisnis", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const params = await searchParams;

    const now = new Date();
    const bulan = Number(params.bulan) || now.getMonth() + 1;
    const tahun = Number(params.tahun) || now.getFullYear();

    const startDate = monthStartYmd(tahun, bulan);
    const endDate = monthEndYmd(tahun, bulan);

    const cookieStore = await cookies();
    const activeBusinessId = cookieStore.get("active_business_id")?.value;
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const businesses: BizRow[] = (businessData || []).map((b) => ({
      id: b.id,
      name: b.name,
      type: normalizeBizType(b.type),
    }));
    const bizMap = Object.fromEntries(businesses.map((b) => [b.id, b]));

    const cookieBiz = businesses.find((b) => b.id === activeBusinessId) || businesses[0] || null;
    const bisnisParam = params.bisnis;
    // Default: cookie active business when present; "all" only when explicitly selected.
    let filterMode: "all" | string;
    if (bisnisParam === "all") {
      filterMode = "all";
    } else if (bisnisParam && bizMap[bisnisParam]) {
      filterMode = bisnisParam;
    } else if (cookieBiz) {
      filterMode = cookieBiz.id;
    } else if (businesses.length > 1) {
      filterMode = "all";
    } else {
      filterMode = businesses[0]?.id || "all";
    }

    const selectedBiz = filterMode === "all" ? null : bizMap[filterMode] || null;
    const isAll = filterMode === "all";

    let kasirOrders: KasirOrderRow[] = [];
    if (selectedBiz?.type === "kuliner" && selectedBiz.id) {
      try {
        kasirOrders = await loadKasirOrders(supabase, selectedBiz.id, user.id, startDate, endDate);
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
    if (!isAll && selectedBiz?.id) allQuery = allQuery.eq("business_id", selectedBiz.id);
    const { data: allTransactions } = await allQuery;

    let monthQuery = supabase
      .from("transactions")
      .select("id, type, amount, category, description, transaction_date, created_at, business_id")
      .eq("scope", "bisnis")
      .eq("user_id", user.id)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .limit(2000);
    if (!isAll && selectedBiz?.id) monthQuery = monthQuery.eq("business_id", selectedBiz.id);
    const { data: monthRows } = await monthQuery
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    // Full month rows for per-business cards (even when list is filtered to one biz).
    type CardTx = { type: string; amount: number; business_id: string | null };
    let monthRowsForCards: CardTx[] = (monthRows || []).map((t) => ({
      type: t.type,
      amount: t.amount,
      business_id: t.business_id,
    }));
    if (businesses.length > 1 && !isAll) {
      const { data: allBizMonth } = await supabase
        .from("transactions")
        .select("type, amount, business_id")
        .eq("scope", "bisnis")
        .eq("user_id", user.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .limit(2000);
      monthRowsForCards = (allBizMonth || []) as CardTx[];
    }

    const transactions = sortBisnisTransactions(monthRows || []);

    const totalIncome =
      allTransactions?.filter((t) => t.type === "pemasukan").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalExpense =
      allTransactions?.filter((t) => t.type === "pengeluaran").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalBalance = totalIncome - totalExpense;

    const monthIncome =
      transactions?.filter((t) => t.type === "pemasukan").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const monthExpense =
      transactions?.filter((t) => t.type === "pengeluaran").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    const perBizMonth = businesses.map((b) => {
      const rows = monthRowsForCards.filter((t) => t.business_id === b.id);
      const income = rows.filter((t) => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0);
      const expense = rows.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + Number(t.amount), 0);
      return { biz: b, income, expense, saldo: income - expense, count: rows.length };
    });

    const filterLabel = isAll
      ? `Semua bisnis (${businesses.length})`
      : selectedBiz
        ? `${selectedBiz.name} · ${bizTypeLabel(selectedBiz.type)}`
        : "Belum ada bisnis";

    return (
      <div className="px-4 py-4 sm:px-8 sm:py-8">
        <h1 className="mb-1 text-2xl font-semibold">Keuangan Bisnis</h1>
        <p className="mb-4 text-[#8B8AA0]">
          Penjualan, modal, operasional dari modul bisnis · filter:{" "}
          <span className="text-[#F0EFF8]">{filterLabel}</span>
          {selectedBiz?.type === "kuliner" ? " · termasuk transaksi kasir di bawah" : ""}.
        </p>

        {businesses.length > 0 && (
          <Suspense>
            <BusinessFinanceFilter businesses={businesses} selected={filterMode} />
          </Suspense>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0F0F1A] p-5">
            <p className="mb-1 text-xs text-[#8B8AA0]">Total Saldo{isAll ? " (tahun)" : ""}</p>
            <p className="font-mono text-xl font-semibold">Rp{totalBalance.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-[10px] text-[#5A5B6A]">{filterLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0F0F1A] p-5">
            <p className="mb-1 text-xs text-[#8B8AA0]">Pemasukan {months[bulan - 1]}</p>
            <p className="font-mono text-xl font-semibold text-[#2DD4BF]">
              Rp{monthIncome.toLocaleString("id-ID")}
            </p>
            <p className="mt-1 text-[10px] text-[#5A5B6A]">
              {months[bulan - 1]} {tahun}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0F0F1A] p-5">
            <p className="mb-1 text-xs text-[#8B8AA0]">Pengeluaran {months[bulan - 1]}</p>
            <p className="font-mono text-xl font-semibold text-[#EC4899]">
              Rp{monthExpense.toLocaleString("id-ID")}
            </p>
            <p className="mt-1 text-[10px] text-[#5A5B6A]">
              {months[bulan - 1]} {tahun}
            </p>
          </div>
        </div>

        {businesses.length > 1 && (
          <div className="mb-6">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#8B8AA0]">
              Ringkasan per bisnis · {months[bulan - 1]} {tahun}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {perBizMonth.map(({ biz, income, expense, saldo, count }) => (
                <a
                  key={biz.id}
                  href={`?bulan=${bulan}&tahun=${tahun}&bisnis=${biz.id}`}
                  className={
                    "block rounded-2xl border p-4 transition-colors " +
                    (filterMode === biz.id
                      ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/5"
                      : "border-white/10 bg-[#0F0F1A] hover:border-white/20")
                  }
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#F0EFF8]">{biz.name}</p>
                      <p className="text-[10px] text-[#8B8AA0]">{bizTypeLabel(biz.type)}</p>
                    </div>
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-[#8B8AA0]">
                      {count} tx
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[9px] text-[#8B8AA0]">Masuk</p>
                      <p className="font-mono text-xs text-[#2DD4BF]">
                        Rp{(income / 1000).toFixed(0)}rb
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#8B8AA0]">Keluar</p>
                      <p className="font-mono text-xs text-[#EC4899]">
                        Rp{(expense / 1000).toFixed(0)}rb
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#8B8AA0]">Saldo</p>
                      <p
                        className={
                          "font-mono text-xs font-semibold " +
                          (saldo >= 0 ? "text-[#F0EFF8]" : "text-[#EC4899]")
                        }
                      >
                        Rp{(saldo / 1000).toFixed(0)}rb
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <Suspense>
          <MonthYearFilter />
        </Suspense>

        <CashFlowChartLazy title="Tren Saldo Bisnis" transactions={(transactions as never) || []} />

        {selectedBiz?.type === "kuliner" && (
          <KasirTransactionsPanel
            orders={kasirOrders}
            monthLabel={`${months[bulan - 1]} ${tahun}`}
            businessName={selectedBiz.name}
          />
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
          <TransactionForm
            userId={user.id}
            scope="bisnis"
            businessId={isAll ? undefined : selectedBiz?.id}
            businesses={businesses}
            requireBusinessPick={isAll}
          />
          <div className="rounded-2xl border border-white/10 bg-[#0F0F1A] p-5">
            <h2 className="mb-1 font-medium">
              Transaksi {months[bulan - 1]} {tahun}
            </h2>
            <p className="mb-4 text-[10px] text-[#5A5B7A]">
              Terbaru di atas
              {isAll || businesses.length > 1 ? " · tiap baris menampilkan nama bisnis" : ""}
            </p>
            <div className="flex flex-col gap-3">
              {transactions.length > 0 ? (
                transactions.map((t, i) => {
                  const dateKey = (t.transaction_date || t.created_at || "").slice(0, 10);
                  const prevKey =
                    i > 0
                      ? (transactions[i - 1].transaction_date || transactions[i - 1].created_at || "").slice(
                          0,
                          10,
                        )
                      : null;
                  const txBiz = t.business_id ? bizMap[t.business_id] : null;
                  return (
                    <Fragment key={t.id}>
                      {dateKey !== prevKey && (
                        <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-[#5A5B7A]">
                          {formatTxDateLabel(dateKey)}
                        </p>
                      )}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-medium">{t.description || t.category || "Transaksi"}</p>
                            {t.category === "Penjualan F&B" && (
                              <span className="rounded-md bg-[#2DD4BF]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#2DD4BF]">
                                Kasir
                              </span>
                            )}
                            {(isAll || businesses.length > 1) && txBiz && (
                              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-[#C4C3D4]">
                                {txBiz.name} · {bizTypeLabel(txBiz.type)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8B8AA0]">
                            {t.category}
                            <span className="mx-1.5">·</span>
                            {formatTxTimeWib(t.created_at)} WIB
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p
                            className={
                              "font-mono text-sm font-medium " +
                              (t.type === "pemasukan" ? "text-[#2DD4BF]" : "text-[#EC4899]")
                            }
                          >
                            {t.type === "pemasukan" ? "+" : "-"}Rp{Number(t.amount).toLocaleString("id-ID")}
                          </p>
                          <DeleteTransactionButton id={t.id} />
                        </div>
                      </div>
                    </Fragment>
                  );
                })
              ) : (
                <p className="text-sm text-[#8B8AA0]">
                  Belum ada transaksi di {months[bulan - 1]} {tahun}
                  {selectedBiz ? ` untuk ${selectedBiz.name}` : isAll ? " (semua bisnis)" : ""}.
                  {businesses.length > 1 && !isAll
                    ? " Coba filter Semua bisnis atau ganti bisnis di atas."
                    : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });
}
