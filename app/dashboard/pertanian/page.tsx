import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import PertanianClient from "./pertanian-client";
import type { AgriDashboardData } from "./lib/types";

export default async function PertanianPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  const business = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;

  if (business?.type !== "pertanian") {
    return (
      <div className="px-8 py-12 text-center">
        <p className="text-[#8B8AA0] mb-4">Modul Pertanian hanya tersedia untuk bisnis tipe Pertanian.</p>
        <Link href="/dashboard/inventory" className="text-violet-400 text-sm hover:underline">Kembali ke Inventory</Link>
      </div>
    );
  }

  const businessId = business.id;

  const [
    { data: products, error: productsErr },
    { data: harvestMeta },
    { data: saprotanMeta },
    { data: fields },
    { data: spraying },
    { data: costs },
    { data: history },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("business_id", businessId).order("name"),
    supabase.from("agri_harvest_meta").select("*").eq("business_id", businessId),
    supabase.from("agri_saprotan_meta").select("*").eq("business_id", businessId),
    supabase.from("agri_fields").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("agri_spraying_records").select("*").eq("business_id", businessId).order("tanggal", { ascending: false }),
    supabase.from("agri_production_costs").select("*").eq("business_id", businessId).order("tanggal", { ascending: false }),
    supabase.from("inventory_history").select("snapshot_date, total_value").eq("user_id", user!.id).order("snapshot_date", { ascending: true }).limit(30),
  ]);

  if (productsErr) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="text-[#EC4899] mb-2">Gagal memuat data pertanian.</p>
        <p className="text-xs text-[#8B8AA0]">{productsErr.message}</p>
      </div>
    );
  }

  const dashboardData: AgriDashboardData = {
    products: products || [],
    harvestMeta: harvestMeta || [],
    saprotanMeta: saprotanMeta || [],
    fields: fields || [],
    spraying: spraying || [],
    costs: costs || [],
    history: history || [],
  };

  return (
    <PertanianClient
      data={dashboardData}
      businessName={business.name}
      userId={user!.id}
      businessId={businessId}
    />
  );
}
