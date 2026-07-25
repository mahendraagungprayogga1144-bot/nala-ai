import { createClient } from "@/lib/supabase/server";
import MarketplaceCenterClient from "./marketplace-center-client";
import { guardPage } from "../lib/page-guard";

export type MpStore = {
  id: string; platform: string; nama_toko: string;
  url_toko: string | null; seller_id: string | null; catatan: string | null;
};
export type MpProduct = {
  id: string; store_id: string; nama: string; sku: string | null;
  harga: number; stok: number; kategori: string | null; platform: string | null; catatan: string | null;
};
export type MpOrder = {
  id: string; store_id: string; no_pesanan: string | null; pembeli: string;
  total: number; status: string; platform: string | null; tanggal: string; catatan: string | null; created_at: string;
};

export default async function MarketplaceCenterPage() {
  return guardPage("Marketplace Center", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="px-8 py-12 text-center text-[#8B8AA0]">Silakan login terlebih dahulu.</div>;
  }

  const [{ data: stores }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("module_marketplace_stores").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("module_mp_products").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("module_mp_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <MarketplaceCenterClient
      userId={user.id}
      stores={(stores || []) as MpStore[]}
      products={(products || []) as MpProduct[]}
      orders={(orders || []) as MpOrder[]}
    />
  );
  });
}
