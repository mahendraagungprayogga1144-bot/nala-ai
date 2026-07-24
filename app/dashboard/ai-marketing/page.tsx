import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import AiMarketingClient from "./ai-marketing-client";

export default async function AiMarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);
  const { data: drafts } = business?.id
    ? await supabase.from("module_marketing_drafts").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };
  return <AiMarketingClient businessId={business?.id || ""} businessName={business?.name || "Bisnis"} userId={user.id} drafts={drafts || []} />;
}
