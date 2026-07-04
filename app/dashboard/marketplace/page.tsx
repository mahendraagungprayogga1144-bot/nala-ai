import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import MarketplaceClient from "./marketplace-client";

export type MpReport = {
  id: string;
  platform: string;
  periode: string | null;
  total_omzet: number;
  total_fee: number;
  dana_diterima: number;
  raw_data: unknown;
  created_at: string;
};

export type MpParsedOrder = {
  id: string;
  report_id: string;
  order_id: string | null;
  platform: string;
  tanggal: string | null;
  nama_produk: string | null;
  sku: string | null;
  harga_jual: number;
  fee_total: number;
  dana_diterima: number;
  status: string | null;
};

export default async function MarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);

  if (!business?.id) {
    return <div className="px-8 py-12 text-center text-[#8B8AA0]">Belum ada bisnis aktif.</div>;
  }

  const [{ data: reports }, { data: orders }] = await Promise.all([
    supabase.from("marketplace_reports").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("marketplace_orders").select("*").eq("platform", "").or(
      `report_id.in.(${(await supabase.from("marketplace_reports").select("id").eq("business_id", business.id)).data?.map(r => r.id).join(",") || "00000000-0000-0000-0000-000000000000"})`
    ).limit(1000),
  ]);

  const reportIds = (reports || []).map(r => r.id);
  let allOrders: MpParsedOrder[] = [];
  if (reportIds.length > 0) {
    const { data } = await supabase.from("marketplace_orders").select("*").in("report_id", reportIds).order("tanggal", { ascending: false });
    allOrders = (data || []) as MpParsedOrder[];
  }

  return (
    <MarketplaceClient
      businessId={business.id}
      businessName={business.name}
      userId={user!.id}
      reports={(reports || []) as MpReport[]}
      parsedOrders={allOrders}
    />
  );
}
