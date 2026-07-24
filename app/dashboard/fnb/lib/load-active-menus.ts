import type { SupabaseClient } from "@supabase/supabase-js";

/** Load active menus; fall back without recipe embed if nested select fails. */
export async function loadActiveMenusForKasir(db: SupabaseClient, businessId: string) {
  const withRecipes = await db
    .from("menus")
    .select("*, menu_recipes(*, products(id, name, cost, stock))")
    .eq("business_id", businessId)
    .eq("status", "aktif")
    .order("kategori");

  if (!withRecipes.error) {
    return { menus: withRecipes.data || [], error: null as string | null };
  }

  const plain = await db
    .from("menus")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "aktif")
    .order("kategori");

  if (plain.error) {
    return { menus: [] as Record<string, unknown>[], error: plain.error.message };
  }

  return {
    menus: (plain.data || []).map((m) => ({ ...m, menu_recipes: [] })),
    error: null as string | null,
  };
}
