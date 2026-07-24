import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import AiRisetClient from "./ai-riset-client";

export default async function AiRisetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);
  const { data: notes } = business?.id
    ? await supabase.from("module_research_notes").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };
  return <AiRisetClient businessId={business?.id || ""} businessName={business?.name || "Bisnis"} userId={user.id} notes={notes || []} />;
}
