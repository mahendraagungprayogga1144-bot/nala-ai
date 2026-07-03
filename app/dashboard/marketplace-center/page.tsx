import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import MarketplaceCenterClient from "./marketplace-center-client";

export default async function MarketplaceCenterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  const { data: stores } = business?.id
    ? await supabase.from("module_marketplace_stores").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };
  return <MarketplaceCenterClient businessId={business?.id || ""} businessName={business?.name || "Bisnis"} userId={user!.id} stores={stores || []} />;
}
