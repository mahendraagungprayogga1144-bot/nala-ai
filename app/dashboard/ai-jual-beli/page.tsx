import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import AiJualBeliClient from "./ai-jual-beli-client";

export default async function AiJualBeliPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);
  const { data: listings } = business?.id
    ? await supabase.from("module_trade_listings").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };
  return <AiJualBeliClient businessId={business?.id || ""} businessName={business?.name || "Bisnis"} userId={user.id} listings={listings || []} />;
}
