import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Service role only — share-link kasir scopes by kasir_token in app code.
 * Never fall back to anon: broad anon policies caused cross-tenant data bleed.
 */
export function createPublicKasirDb(): SupabaseClient | null {
  return createAdminClient();
}

export async function resolveEmployeeByToken(db: SupabaseClient, token: string) {
  const { data: employee, error } = await db
    .from("employees")
    .select("*")
    .eq("kasir_token", token)
    .eq("aktif", true)
    .maybeSingle();
  if (error || !employee) return null;
  return employee;
}
