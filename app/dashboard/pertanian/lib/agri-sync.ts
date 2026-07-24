import type { SupabaseClient } from "@supabase/supabase-js";
import { isHarvestCategory, isSaprotanCategory } from "./constants";

type AgriProduct = { stock: number; cost: number | null; category: string | null; price?: number | null };

/** HPP estimasi untuk UI — saprotan di gudang belum terpakai tidak dihitung sebagai biaya */
export function computeAgriTotalCost(
  products: AgriProduct[],
  biayaProduksi: number,
  biayaSemprot: number,
): { totalCost: number; saprotanCost: number; biayaProduksi: number; biayaSemprot: number; harvestStock: number; hppPerUnit: number } {
  const saprotanCost = products
    .filter(p => isSaprotanCategory(p.category))
    .reduce((s, p) => s + Number(p.cost || 0) * p.stock, 0);
  const totalCost = biayaProduksi + biayaSemprot;
  const harvestStock = products
    .filter(p => isHarvestCategory(p.category))
    .reduce((s, p) => s + p.stock, 0);
  const hppPerUnit = harvestStock > 0 && totalCost > 0 ? Math.round(totalCost / harvestStock) : 0;
  return { totalCost, saprotanCost, biayaProduksi, biayaSemprot, harvestStock, hppPerUnit };
}

export function calcAgriProductHpp(product: AgriProduct, globalHppPerUnit: number): number {
  if (product.cost && product.cost > 0) return Math.round(product.cost);
  return globalHppPerUnit;
}

export async function insertKeuanganPengeluaran(
  supabase: SupabaseClient,
  opts: { userId: string; businessId: string; category: string; description: string; amount: number; tanggal: string },
) {
  if (opts.amount <= 0) return null as string | null;
  if (!opts.businessId) {
    console.error("[agri-sync] missing businessId for pengeluaran");
    return null;
  }
  const { data, error } = await supabase.from("transactions").insert({
    user_id: opts.userId,
    business_id: opts.businessId,
    type: "pengeluaran",
    scope: "bisnis",
    category: opts.category,
    description: opts.description,
    amount: opts.amount,
    transaction_date: opts.tanggal,
  }).select("id").single();
  if (error) {
    console.error("[agri-sync] pengeluaran", error.message);
    throw new Error(error.message);
  }
  return data?.id || null;
}

export async function deleteKeuanganById(
  supabase: SupabaseClient,
  txId: string | null | undefined,
) {
  if (!txId) return;
  await supabase.from("transactions").delete().eq("id", txId);
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

  // Biaya produksi/semprot sudah masuk pengeluaran saat dicatat —
  // jual hanya catat pemasukan (hindari double HPP di keuangan).
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

  return { totalJual, totalHpp, laba };
}
