import type { SupabaseClient } from "@supabase/supabase-js";

/** Treat null/empty/active variants as sellable in kasir. */
export function isMenuActiveForKasir(status: string | null | undefined): boolean {
  if (status == null || String(status).trim() === "") return true;
  const s = String(status).trim().toLowerCase();
  if (s === "nonaktif" || s === "inactive" || s === "0" || s === "false" || s === "off") return false;
  return true; // aktif, active, or any other non-inactive value
}

type LoadResult = {
  menus: Record<string, unknown>[];
  error: string | null;
  inactiveCount: number;
  totalForBusiness: number;
  otherBusinessActiveCount: number;
};

async function selectMenus(
  db: SupabaseClient,
  filter: { businessId?: string; userId?: string },
) {
  const withRecipes = db
    .from("menus")
    .select("*, menu_recipes(*, products(id, name, cost, stock))");
  const q = filter.businessId
    ? withRecipes.eq("business_id", filter.businessId)
    : withRecipes.eq("user_id", filter.userId!);
  const res = await q.order("kategori");
  if (!res.error) return { rows: (res.data || []) as Record<string, unknown>[], error: null as string | null };

  let plain = db.from("menus").select("*");
  plain = filter.businessId
    ? plain.eq("business_id", filter.businessId)
    : plain.eq("user_id", filter.userId!);
  const fallback = await plain.order("kategori");
  if (fallback.error) return { rows: [] as Record<string, unknown>[], error: fallback.error.message };
  return {
    rows: (fallback.data || []).map((m) => ({ ...m, menu_recipes: [] })),
    error: null as string | null,
  };
}

/** Load sellable menus for kasir; tolerant of status variants and embed failures. */
export async function loadActiveMenusForKasir(
  db: SupabaseClient,
  businessId: string,
  userId?: string,
): Promise<LoadResult> {
  const { rows, error } = await selectMenus(db, { businessId });
  if (error) {
    return { menus: [], error, inactiveCount: 0, totalForBusiness: 0, otherBusinessActiveCount: 0 };
  }

  const active = rows.filter((m) => isMenuActiveForKasir(m.status as string | null | undefined));
  const inactiveCount = rows.length - active.length;

  let otherBusinessActiveCount = 0;
  if (active.length === 0 && userId) {
    const other = await selectMenus(db, { userId });
    if (!other.error) {
      otherBusinessActiveCount = other.rows.filter(
        (m) =>
          m.business_id !== businessId &&
          isMenuActiveForKasir(m.status as string | null | undefined),
      ).length;
    }
  }

  return {
    menus: active,
    error: null,
    inactiveCount,
    totalForBusiness: rows.length,
    otherBusinessActiveCount,
  };
}
