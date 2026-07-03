import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import MarketplaceCenterClient from "./marketplace-center-client";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);

  if (!business?.id) {
    return <div className="px-8 py-12 text-center text-[#8B8AA0]">Belum ada bisnis aktif.</div>;
  }

  const [{ data: stores }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("module_marketplace_stores").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("module_mp_products").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("module_mp_orders").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
  ]);

  return (
    <MarketplaceCenterClient
      businessId={business.id}
      businessName={business.name}
      userId={user!.id}
      stores={(stores || []) as MpStore[]}
      products={(products || []) as MpProduct[]}
      orders={(orders || []) as MpOrder[]}
    />
  );
}
