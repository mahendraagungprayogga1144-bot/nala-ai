import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type ActiveBusiness = { id: string; name: string; type: string | null };

export async function getActiveBusiness(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ business: ActiveBusiness | null; businesses: ActiveBusiness[] }> {
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const list = (businesses || []) as ActiveBusiness[];
  const cookieStore = await cookies();
  const activeId = cookieStore.get("active_business_id")?.value;
  const business = list.find(b => b.id === activeId) || list[0] || null;
  return { business, businesses: list };
}
