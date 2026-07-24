import PertanianClient from "./pertanian-client";
import type { AgriDashboardData } from "./lib/types";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import { normalizeBizType } from "@/lib/auth/post-login";
import { guardPage } from "../lib/page-guard";

export default async function PertanianPage() {
  return guardPage("Modul Pertanian", async () => {
  const { supabase, user, business } = await getActiveBusiness("pertanian");
  if (!user) return null;

  if (!business || normalizeBizType(business.type) !== "pertanian") {
    return <WrongBizType label="Pertanian" />;
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
    supabase.from("inventory_history").select("snapshot_date, total_value").eq("user_id", user.id).order("snapshot_date", { ascending: true }).limit(30),
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
      userId={user.id}
      businessId={businessId}
    />
  );
  });
}
