import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Prefer service role so share-link kasir works despite owner-only RLS. */
export function createPublicKasirDb(): SupabaseClient | null {
  const admin = createAdminClient();
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
