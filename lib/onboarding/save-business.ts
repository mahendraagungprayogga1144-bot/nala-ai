import type { SupabaseClient } from "@supabase/supabase-js";

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
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `active_business_id=${businessId}; path=/; max-age=${maxAge}; samesite=lax`;
  // Skip repeated onboarding DB checks in middleware
  document.cookie = `ob_done=1; path=/; max-age=${maxAge}; samesite=lax`;
}
