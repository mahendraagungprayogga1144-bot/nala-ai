import { createClient } from "@/lib/supabase/server";
import MarketplaceClient from "./marketplace-client";
import { guardPage } from "../lib/page-guard";

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
  return guardPage("Marketplace", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="px-8 py-12 text-center text-[#8B8AA0]">Silakan login terlebih dahulu.</div>;
  }

  const { data: reports } = await supabase
    .from("marketplace_reports").select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const reportIds = (reports || []).map(r => r.id);
  let allOrders: MpParsedOrder[] = [];
  if (reportIds.length > 0) {
    const { data } = await supabase
      .from("marketplace_orders").select("*")
      .in("report_id", reportIds)
      .order("tanggal", { ascending: false });
    allOrders = (data || []) as MpParsedOrder[];
  }

  return (
    <MarketplaceClient
      userId={user.id}
      reports={(reports || []) as MpReport[]}
      parsedOrders={allOrders}
    />
  );
  });
}
