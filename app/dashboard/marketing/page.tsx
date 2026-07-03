import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import MarketingClient from "./marketing-client";

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  return <MarketingClient businessName={business?.name || "Bisnis"} />;
}
