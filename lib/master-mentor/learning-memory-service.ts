import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import { LEARNING_SOURCES, type LearningRecord } from "./memory-types";
import { assertOwnedBusiness } from "./ownership";
import { MentorValidationError } from "./types";
import {
  cleanText,
  isMissingTable,
  optionalEnum,
  requireDate,
  requireText,
  requireUuid,
} from "./text";

const TABLE = "module_master_mentor_learnings";

export type LearningInput = {
  business_id: string;
  related_decision_id: string | null;
  lesson: string;
  evidence: string;
  source: string;
  recorded_date: string;
};

export function parseLearningInput(body: unknown): LearningInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const related = cleanText(raw.related_decision_id, 80);
  return {
    business_id: requireUuid(raw.business_id, "Business ID"),
    related_decision_id: related
      ? requireUuid(raw.related_decision_id, "Related decision ID")
      : null,
    lesson: requireText(raw.lesson, "Lesson", 4000),
    evidence: cleanText(raw.evidence, 4000),
    source: optionalEnum(raw.source, LEARNING_SOURCES, "owner_entry", "Source"),
    recorded_date: requireDate(
      raw.recorded_date || new Date().toISOString().slice(0, 10),
      "Recorded date",
    ),
  };
}

export async function listLearnings(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { businessId?: string; q?: string } = {},
): Promise<{ rows: LearningRecord[]; notice: string | null }> {
  let query = db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("recorded_date", { ascending: false });
  if (opts.businessId) {
    await assertOwnedBusiness(db, ownerUserId, opts.businessId);
    query = query.eq("business_id", opts.businessId);
  }
  const term = cleanText(opts.q, 120);
  if (term) {
    query = query.or(`lesson.ilike.%${term}%,evidence.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel learning memory belum aktif. Jalankan migration Phase 2." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as LearningRecord[], notice: null };
}

export async function createLearning(
  db: SupabaseClient,
  ownerUserId: string,
  input: LearningInput,
): Promise<LearningRecord> {
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  if (input.related_decision_id) {
    const { data: dec } = await db
      .from("module_master_mentor_decisions")
      .select("id, business_id")
      .eq("id", input.related_decision_id)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (!dec) throw new MentorValidationError("Related decision tidak ditemukan.");
    if (dec.business_id !== input.business_id) {
      throw new MentorValidationError("Related decision harus dari bisnis yang sama.");
    }
  }
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({ owner_user_id: ownerUserId, ...input, created_at: now, updated_at: now })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel learning memory belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan learning.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "learning",
    entityId: data.id,
    action: "create",
    summary: "Learning recorded",
    after: data,
  });
  return data as LearningRecord;
}

export async function updateLearning(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
  input: LearningInput,
): Promise<LearningRecord> {
  const id = requireUuid(idRaw, "Learning ID");
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Learning tidak ditemukan.");
  const { data, error } = await db
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message || "Gagal memperbarui learning.");
  if (!data) throw new MentorValidationError("Learning tidak ditemukan.");
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "learning",
    entityId: id,
    action: "update",
    summary: "Learning updated",
    before,
    after: data,
  });
  return data as LearningRecord;
}

export async function deleteLearning(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
): Promise<void> {
  const id = requireUuid(idRaw, "Learning ID");
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Learning tidak ditemukan.");
  const { error } = await db.from(TABLE).delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new MentorValidationError(error.message || "Gagal menghapus learning.");
  await writeAudit(db, {
    ownerUserId,
    businessId: before.business_id,
    entityType: "learning",
    entityId: id,
    action: "delete",
    summary: "Learning deleted",
    before,
  });
}
