import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import type { OwnerMemory } from "./memory-types";
import { MentorValidationError } from "./types";
import { cleanText, isMissingTable } from "./text";

const TABLE = "module_master_mentor_owner_memory";

const empty = (ownerUserId: string): OwnerMemory => ({
  owner_user_id: ownerUserId,
  business_vision: "",
  long_term_goals: "",
  communication_style: "",
  decision_preferences: "",
  business_philosophy: "",
  risk_tolerance: "",
  working_preferences: "",
  created_at: "",
  updated_at: "",
});

export type OwnerMemoryInput = {
  business_vision: string;
  long_term_goals: string;
  communication_style: string;
  decision_preferences: string;
  business_philosophy: string;
  risk_tolerance: string;
  working_preferences: string;
};

export function parseOwnerMemoryInput(body: unknown): OwnerMemoryInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  return {
    business_vision: cleanText(raw.business_vision, 4000),
    long_term_goals: cleanText(raw.long_term_goals, 4000),
    communication_style: cleanText(raw.communication_style, 2000),
    decision_preferences: cleanText(raw.decision_preferences, 2000),
    business_philosophy: cleanText(raw.business_philosophy, 4000),
    risk_tolerance: cleanText(raw.risk_tolerance, 2000),
    working_preferences: cleanText(raw.working_preferences, 2000),
  };
}

export async function getOwnerMemory(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ row: OwnerMemory; notice: string | null }> {
  const { data, error } = await db.from(TABLE).select("*").eq("owner_user_id", ownerUserId).maybeSingle();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { row: empty(ownerUserId), notice: "Tabel owner memory belum aktif. Jalankan migration Phase 2." };
    }
    return { row: empty(ownerUserId), notice: error.message };
  }
  return { row: (data as OwnerMemory) || empty(ownerUserId), notice: null };
}

export async function upsertOwnerMemory(
  db: SupabaseClient,
  ownerUserId: string,
  input: OwnerMemoryInput,
): Promise<OwnerMemory> {
  const now = new Date().toISOString();
  const { row: before } = await getOwnerMemory(db, ownerUserId);
  const payload = {
    owner_user_id: ownerUserId,
    ...input,
    updated_at: now,
    created_at: before.created_at || now,
  };
  const { data, error } = await db.from(TABLE).upsert(payload, { onConflict: "owner_user_id" }).select("*").single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel owner memory belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan owner memory.");
  }
  await writeAudit(db, {
    ownerUserId,
    entityType: "owner_memory",
    entityId: ownerUserId,
    action: before.created_at ? "update" : "create",
    summary: "Owner memory saved",
    before: before.created_at ? before : null,
    after: data,
  });
  return data as OwnerMemory;
}

export async function clearOwnerMemory(db: SupabaseClient, ownerUserId: string): Promise<void> {
  const { row: before } = await getOwnerMemory(db, ownerUserId);
  const { error } = await db.from(TABLE).delete().eq("owner_user_id", ownerUserId);
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel owner memory belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal menghapus owner memory.");
  }
  await writeAudit(db, {
    ownerUserId,
    entityType: "owner_memory",
    entityId: ownerUserId,
    action: "delete",
    summary: "Owner memory cleared",
    before,
  });
}
