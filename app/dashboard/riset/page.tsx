import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import RisetClient from "./riset-client";

export default async function RisetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  return <RisetClient businessName={business?.name || "Bisnis"} />;
}
