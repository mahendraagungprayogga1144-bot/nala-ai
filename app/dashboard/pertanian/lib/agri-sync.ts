import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertKeuanganPengeluaran(
  supabase: SupabaseClient,
  opts: { userId: string; businessId: string; category: string; description: string; amount: number; tanggal: string },
) {
  if (opts.amount <= 0) return;
  await supabase.from("transactions").insert({
    user_id: opts.userId,
    business_id: opts.businessId,
    type: "pengeluaran",
    scope: "bisnis",
    category: opts.category,
    description: opts.description,
    amount: opts.amount,
    transaction_date: opts.tanggal,
  });
}

/** HPP per unit panen = total biaya produksi / total stok panen (kg/unit) */
export function calcAgriHppPerUnit(totalBiaya: number, totalPanenStock: number): number {
  if (totalPanenStock <= 0 || totalBiaya <= 0) return 0;
  return Math.round(totalBiaya / totalPanenStock);
}

export async function recordAgriPenjualan(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    businessId: string;
    productName: string;
    qty: number;
    harga: number;
    hppPerUnit: number;
    tanggal: string;
  },
) {
  const totalJual = opts.qty * opts.harga;
  const totalHpp = opts.qty * opts.hppPerUnit;
  const laba = totalJual - totalHpp;

  const { error: incErr } = await supabase.from("transactions").insert({
    user_id: opts.userId,
    business_id: opts.businessId,
    type: "pemasukan",
    scope: "bisnis",
    category: "Penjualan Panen",
    description: `Jual ${opts.productName} x${opts.qty}`,
    amount: totalJual,
    transaction_date: opts.tanggal,
  });
  if (incErr) throw new Error(incErr.message);

  if (totalHpp > 0) {
    const { error: hppErr } = await supabase.from("transactions").insert({
      user_id: opts.userId,
      business_id: opts.businessId,
      type: "pengeluaran",
      scope: "bisnis",
      category: "HPP",
      description: `HPP ${opts.productName} x${opts.qty}`,
      amount: totalHpp,
      transaction_date: opts.tanggal,
    });
    if (hppErr) throw new Error(hppErr.message);
  }

  return { totalJual, totalHpp, laba };
}
