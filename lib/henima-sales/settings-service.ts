import type { Actor } from "./types";
import { ForbiddenError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";

export const DEFAULT_SALES_BRAND = "Henima Scent";

function looksLikePlaceholder(name: string | null | undefined) {
  const n = (name || "").trim();
  return n.length <= 2;
}

/** Nama tampilan modul sales — bukan nama tenant Gercep. */
export function resolveSalesBrandName(saved?: string | null, tenantName?: string | null) {
  const s = (saved || "").trim();
  if (s) return s;
  if (tenantName && !looksLikePlaceholder(tenantName)) return tenantName.trim();
  return DEFAULT_SALES_BRAND;
}

export async function getSalesSettings(
  db: SalesDb,
  businessId: string,
  tenantName?: string | null,
): Promise<{ displayName: string; tagline: string | null }> {
  try {
    const { data, error } = await db
      .from("module_sales_settings")
      .select("display_name, tagline")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) return { displayName: resolveSalesBrandName(null, tenantName), tagline: null };
    const displayName = resolveSalesBrandName(data?.display_name, tenantName);
    const tagline = (data?.tagline || "").trim() || null;
    if (!(data?.display_name || "").trim()) {
      await db.from("module_sales_settings").upsert({
        business_id: businessId,
        display_name: displayName,
        tagline,
        updated_at: new Date().toISOString(),
      });
    }
    return { displayName, tagline };
  } catch {
    return { displayName: resolveSalesBrandName(null, tenantName), tagline: null };
  }
}

export async function getSalesBrandName(
  db: SalesDb,
  businessId: string,
  tenantName?: string | null,
): Promise<string> {
  const s = await getSalesSettings(db, businessId, tenantName);
  return s.displayName;
}

export async function upsertSalesSettings(
  db: SalesDb,
  actor: Actor,
  input: { displayName: string; tagline?: string | null },
) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang dapat mengubah pengaturan modul ini.");
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new SalesError("Nama bisnis minimal 2 karakter.", "name_required");
  const tagline = input.tagline?.trim() || null;
  const { data, error } = await db
    .from("module_sales_settings")
    .upsert({
      business_id: actor.businessId,
      display_name: displayName,
      tagline,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal simpan pengaturan.", "settings_save");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "sales_settings",
    entityId: actor.businessId,
    newValue: { display_name: displayName, tagline },
  });
  return data as { business_id: string; display_name: string; tagline: string | null };
}
