import { createClient } from "@/lib/supabase/server";
import TransactionForm from "../transaction-form";
import DeleteTransactionButton from "../delete-transaction-button";
import MonthYearFilter from "../month-year-filter";
import { Suspense } from "react";
import CashFlowChartLazy from "../cash-flow-chart-lazy";

export default async function KeuanganPribadiPage({ searchParams }: { searchParams: Promise<{ bulan?: string; tahun?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const params = await searchParams;

  const now = new Date();
  const bulan = Number(params.bulan) || now.getMonth() + 1;
  const tahun = Number(params.tahun) || now.getFullYear();

  const startDate = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const endDate = new Date(tahun, bulan, 0).toISOString().split("T")[0];

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const { data: allTransactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("scope", "pribadi");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("scope", "pribadi")
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: false });

  const totalIncome = allTransactions?.filter((t) => t.type === "pemasukan").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalExpense = allTransactions?.filter((t) => t.type === "pengeluaran").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalBalance = totalIncome - totalExpense;

  const monthIncome = transactions?.filter((t) => t.type === "pemasukan").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const monthExpense = transactions?.filter((t) => t.type === "pengeluaran").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8">
      <h1 className="text-2xl font-semibold mb-1">Keuangan Pribadi</h1>
      <p className="text-[#8B8AA0] mb-6">Gaji, belanja, dan tagihan pribadi kamu.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-[#8B8AA0] mb-1">Total Saldo</p>
          <p className="text-xl font-mono font-semibold">Rp{totalBalance.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[#5A5B6A] mt-1">Semua waktu</p>
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

      <CashFlowChartLazy transactions={(transactions as never) || []} />

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
        <TransactionForm userId={user.id} scope="pribadi" businessId={business?.id} />
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
          <h2 className="font-medium mb-4">Transaksi {months[bulan - 1]} {tahun}</h2>
          <div className="flex flex-col gap-3">
            {transactions && transactions.length > 0 ? (
              transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <p className="text-sm font-medium">{t.description || t.category || "Transaksi"}</p>
                    <p className="text-xs text-[#8B8AA0]">
                      {t.category}
                      <span className="mx-1.5">·</span>
                      {new Date(t.transaction_date || t.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={"font-mono text-sm font-medium " + (t.type === "pemasukan" ? "text-[#2DD4BF]" : "text-[#EC4899]")}>
                      {t.type === "pemasukan" ? "+" : "-"}Rp{Number(t.amount).toLocaleString("id-ID")}
                    </p>
                    <DeleteTransactionButton id={t.id} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#8B8AA0]">Belum ada transaksi di {months[bulan - 1]} {tahun}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
