import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import MultiPlatformClient from "./multi-platform-client";

export default async function MultiPlatformPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);
  const { data: channels } = business?.id
    ? await supabase.from("module_platform_channels").select("*").eq("business_id", business.id).order("channel")
    : { data: [] };
  return <MultiPlatformClient businessId={business?.id || ""} businessName={business?.name || "Bisnis"} userId={user.id} channels={channels || []} />;
}
