import type { SupabaseClient } from "@supabase/supabase-js";
import { setFastGateCookies } from "@/lib/auth/post-login";

export async function saveOnboardingBusiness(
  supabase: SupabaseClient,
  userId: string,
  opts: { name: string; type: string; isNew?: boolean },
) {
  const name = opts.name.trim();
  const type = opts.type;

  if (opts.isNew) {
    const { data, error } = await supabase
      .from("businesses")
      .insert({ user_id: userId, name, type })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  // Single round-trip: try update first business; if none, insert
  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("businesses")
      .update({ name, type })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({ user_id: userId, name, type })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export function setActiveBusinessCookie(businessId: string) {
  setFastGateCookies({ businessId });
}
