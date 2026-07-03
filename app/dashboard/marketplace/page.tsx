import MarketplaceClient from "./marketplace-client";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  return <MarketplaceClient businessName={business?.name || "Bisnis"} />;
}
