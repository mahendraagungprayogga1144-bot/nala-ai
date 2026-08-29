import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesError } from "./types";

export type SalesDb = SupabaseClient;

export function salesDb(): SalesDb {
  const db = createAdminClient();
  if (!db) {
    throw new SalesError("Server belum dikonfigurasi (service role).", "misconfigured", 503);
  }
  return db;
}

export function rpcMessage(err: { message?: string } | null | undefined) {
  const m = err?.message || "";
  if (m.includes("stock_insufficient")) return "Stok tidak cukup untuk transaksi ini.";
  if (m.includes("product_not_found")) return "Produk tidak ditemukan.";
  if (m.includes("quantity_invalid")) return "Jumlah tidak valid.";
  if (m.includes("price_invalid")) return "Harga tidak valid.";
  if (m.includes("sales_not_found")) return "Akun sales tidak valid.";
  if (m.includes("order_not_found")) return "Transaksi tidak ditemukan.";
  return "Terjadi masalah saat menyimpan transaksi. Transaksi belum tercatat. Silakan coba lagi.";
}
