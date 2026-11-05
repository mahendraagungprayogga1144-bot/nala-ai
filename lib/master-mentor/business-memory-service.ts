import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import type { BusinessMemoryProfile } from "./memory-types";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  MentorValidationError,
  isBusinessCategory,
  isBusinessStatus,
} from "./types";
import { cleanText, isMissingTable, requireText, requireUuid } from "./text";
import { assertOwnedBusiness } from "./ownership";

const TABLE = "module_master_mentor_businesses";

export type BusinessMemoryInput = {
  name: string;
  category: string;
  description: string;
  status: string;
  targets: string;
  business_model: string;
  products_services: string;
  target_customers: string;
  sales_channels: string;
  operational_structure: string;
  business_goals: string;
  current_challenges: string;
};

export function parseBusinessMemoryInput(body: unknown): BusinessMemoryInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const name = requireText(raw.name, "Business name", 120);
  const category = cleanText(raw.category, 40).toLowerCase();
  const status = cleanText(raw.status, 20).toLowerCase() || "draft";
  if (!isBusinessCategory(category)) {
    throw new MentorValidationError(`Kategori tidak valid. Pilih: ${BUSINESS_CATEGORIES.join(", ")}.`);
  }
  if (!isBusinessStatus(status)) {
    throw new MentorValidationError(`Status tidak valid. Pilih: ${BUSINESS_STATUSES.join(", ")}.`);
  }
  return {
    name,
    category,
    description: cleanText(raw.description, 4000),
    status,
    targets: cleanText(raw.targets, 4000),
    business_model: cleanText(raw.business_model, 4000),
    products_services: cleanText(raw.products_services, 4000),
    target_customers: cleanText(raw.target_customers, 4000),
    sales_channels: cleanText(raw.sales_channels, 4000),
    operational_structure: cleanText(raw.operational_structure, 4000),
    business_goals: cleanText(raw.business_goals, 4000),
    current_challenges: cleanText(raw.current_challenges, 4000),
  };
}

export async function listBusinessMemory(
  db: SupabaseClient,
  ownerUserId: string,
  q?: string,
): Promise<{ rows: BusinessMemoryProfile[]; notice: string | null }> {
  let query = db.from(TABLE).select("*").eq("owner_user_id", ownerUserId).order("created_at", { ascending: true });
  const term = cleanText(q, 120);
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,description.ilike.%${term}%,business_model.ilike.%${term}%,products_services.ilike.%${term}%,current_challenges.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel business memory belum aktif. Jalankan migration." };
    }
    // Older schema without new columns — fall back to basic select
    if (/column|does not exist/i.test(error.message || "")) {
      const basic = await db
        .from(TABLE)
        .select("id, owner_user_id, name, category, description, status, targets, created_at, updated_at")
        .eq("owner_user_id", ownerUserId)
        .order("created_at", { ascending: true });
      if (basic.error) return { rows: [], notice: basic.error.message };
      const rows = (basic.data || []).map((r) => ({
        ...r,
        business_model: "",
        products_services: "",
        target_customers: "",
        sales_channels: "",
        operational_structure: "",
        business_goals: "",
        current_challenges: "",
      })) as BusinessMemoryProfile[];
      return {
        rows,
        notice: "Kolom business memory belum ada. Jalankan migration Phase 2 untuk field lengkap.",
      };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as BusinessMemoryProfile[], notice: null };
}

export async function getBusinessMemory(
  db: SupabaseClient,
  ownerUserId: string,
  businessId: string,
): Promise<BusinessMemoryProfile | null> {
  await assertOwnedBusiness(db, ownerUserId, businessId);
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", businessId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message);
  return (data as BusinessMemoryProfile) || null;
}

export async function updateBusinessMemory(
  db: SupabaseClient,
  ownerUserId: string,
  businessIdRaw: string,
  input: BusinessMemoryInput,
): Promise<BusinessMemoryProfile> {
  const businessId = requireUuid(businessIdRaw, "Business ID");
  const before = await getBusinessMemory(db, ownerUserId, businessId);
  const { data, error } = await db
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", businessId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, TABLE) || /column|does not exist/i.test(error.message || "")) {
      throw new MentorValidationError(
        "Kolom business memory belum aktif. Jalankan migration Phase 2 terlebih dahulu.",
      );
    }
    throw new MentorValidationError(error.message || "Gagal memperbarui business memory.");
  }
  if (!data) throw new MentorValidationError("Bisnis tidak ditemukan.");
  await writeAudit(db, {
    ownerUserId,
    businessId,
    entityType: "business_memory",
    entityId: businessId,
    action: "update",
    summary: `Business knowledge updated: ${input.name}`,
    before,
    after: data,
  });
  return data as BusinessMemoryProfile;
}
