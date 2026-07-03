import type { SupabaseClient } from "@supabase/supabase-js";
import { isHarvestCategory, isSaprotanCategory } from "./constants";

type AgriProduct = { stock: number; cost: number | null; category: string | null; price?: number | null };

/** Total biaya produksi = biaya catatan + semprot + nilai stok saprotan (sama seperti Modul Pertanian) */
export function computeAgriTotalCost(
  products: AgriProduct[],
  biayaProduksi: number,
  biayaSemprot: number,
): { totalCost: number; saprotanCost: number; biayaProduksi: number; biayaSemprot: number; harvestStock: number; hppPerUnit: number } {
  const saprotanCost = products
    .filter(p => isSaprotanCategory(p.category))
    .reduce((s, p) => s + Number(p.cost || 0) * p.stock, 0);
  const totalCost = biayaProduksi + biayaSemprot + saprotanCost;
  const harvestStock = products
    .filter(p => isHarvestCategory(p.category))
    .reduce((s, p) => s + p.stock, 0);
  const hppPerUnit = harvestStock > 0 && totalCost > 0 ? Math.round(totalCost / harvestStock) : 0;
  return { totalCost, saprotanCost, biayaProduksi, biayaSemprot, harvestStock, hppPerUnit };
}

/** HPP per unit untuk produk panen: pakai cost produk jika diisi, else alokasi global */
export function calcAgriProductHpp(product: AgriProduct, globalHppPerUnit: number): number {
  if (product.cost && product.cost > 0) return Math.round(product.cost);
  return globalHppPerUnit;
}

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
