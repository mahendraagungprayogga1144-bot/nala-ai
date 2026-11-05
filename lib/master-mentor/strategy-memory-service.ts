import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import { STRATEGY_STATUSES, type StrategyRecord } from "./memory-types";
import { assertOwnedBusiness } from "./ownership";
import { MentorValidationError } from "./types";
import {
  cleanText,
  isMissingTable,
  optionalEnum,
  requireText,
  requireUuid,
} from "./text";

const TABLE = "module_master_mentor_strategies";

export type StrategyInput = {
  business_id: string;
  title: string;
  business_strategy: string;
  short_term_targets: string;
  medium_term_targets: string;
  long_term_targets: string;
  growth_plans: string;
  expansion_plans: string;
  marketing_strategies: string;
  operational_strategies: string;
  milestones: string;
  status: string;
};

export function parseStrategyInput(body: unknown): StrategyInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  return {
    business_id: requireUuid(raw.business_id, "Business ID"),
    title: requireText(raw.title, "Strategy title", 200),
    business_strategy: cleanText(raw.business_strategy, 4000),
    short_term_targets: cleanText(raw.short_term_targets, 4000),
    medium_term_targets: cleanText(raw.medium_term_targets, 4000),
    long_term_targets: cleanText(raw.long_term_targets, 4000),
    growth_plans: cleanText(raw.growth_plans, 4000),
    expansion_plans: cleanText(raw.expansion_plans, 4000),
    marketing_strategies: cleanText(raw.marketing_strategies, 4000),
    operational_strategies: cleanText(raw.operational_strategies, 4000),
    milestones: cleanText(raw.milestones, 4000),
    status: optionalEnum(raw.status, STRATEGY_STATUSES, "draft", "Strategy status"),
  };
}

export async function listStrategies(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { businessId?: string; q?: string } = {},
): Promise<{ rows: StrategyRecord[]; notice: string | null }> {
  let query = db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false });
  if (opts.businessId) {
    await assertOwnedBusiness(db, ownerUserId, opts.businessId);
    query = query.eq("business_id", opts.businessId);
  }
  const term = cleanText(opts.q, 120);
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,business_strategy.ilike.%${term}%,growth_plans.ilike.%${term}%,milestones.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel strategic memory belum aktif. Jalankan migration Phase 2." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as StrategyRecord[], notice: null };
}

export async function createStrategy(
  db: SupabaseClient,
  ownerUserId: string,
  input: StrategyInput,
): Promise<StrategyRecord> {
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({ owner_user_id: ownerUserId, ...input, created_at: now, updated_at: now })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel strategic memory belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan strategi.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "strategy",
    entityId: data.id,
    action: "create",
    summary: `Strategy created: ${input.title}`,
    after: data,
  });
  return data as StrategyRecord;
}

export async function updateStrategy(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
  input: StrategyInput,
): Promise<StrategyRecord> {
  const id = requireUuid(idRaw, "Strategy ID");
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Strategi tidak ditemukan.");
  const { data, error } = await db
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message || "Gagal memperbarui strategi.");
  if (!data) throw new MentorValidationError("Strategi tidak ditemukan.");
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "strategy",
    entityId: id,
    action: "update",
    summary: `Strategy updated: ${input.title}`,
    before,
    after: data,
  });
  return data as StrategyRecord;
}

export async function deleteStrategy(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
): Promise<void> {
  const id = requireUuid(idRaw, "Strategy ID");
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Strategi tidak ditemukan.");
  const { error } = await db.from(TABLE).delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new MentorValidationError(error.message || "Gagal menghapus strategi.");
  await writeAudit(db, {
    ownerUserId,
    businessId: before.business_id,
    entityType: "strategy",
    entityId: id,
    action: "delete",
    summary: `Strategy deleted: ${before.title}`,
    before,
  });
}
