import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import { DECISION_STATUSES, type DecisionRecord } from "./memory-types";
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

const TABLE = "module_master_mentor_decisions";

export type DecisionInput = {
  business_id: string;
  title: string;
  description: string;
  reasoning: string;
  alternatives: string;
  expected_outcome: string;
  risks: string;
  decision_date: string;
  status: string;
  actual_outcome: string;
  review_notes: string;
};

export function parseDecisionInput(body: unknown): DecisionInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  return {
    business_id: requireUuid(raw.business_id, "Business ID"),
    title: requireText(raw.title, "Decision title", 200),
    description: cleanText(raw.description, 4000),
    reasoning: cleanText(raw.reasoning, 4000),
    alternatives: cleanText(raw.alternatives, 4000),
    expected_outcome: cleanText(raw.expected_outcome, 4000),
    risks: cleanText(raw.risks, 4000),
    decision_date: requireDate(raw.decision_date || new Date().toISOString().slice(0, 10), "Decision date"),
    status: optionalEnum(raw.status, DECISION_STATUSES, "proposed", "Decision status"),
    actual_outcome: cleanText(raw.actual_outcome, 4000),
    review_notes: cleanText(raw.review_notes, 4000),
  };
}

export async function listDecisions(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { businessId?: string; q?: string } = {},
): Promise<{ rows: DecisionRecord[]; notice: string | null }> {
  let query = db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("decision_date", { ascending: false });
  if (opts.businessId) {
    await assertOwnedBusiness(db, ownerUserId, opts.businessId);
    query = query.eq("business_id", opts.businessId);
  }
  const term = cleanText(opts.q, 120);
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,reasoning.ilike.%${term}%,actual_outcome.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel decision memory belum aktif. Jalankan migration Phase 2." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as DecisionRecord[], notice: null };
}

export async function createDecision(
  db: SupabaseClient,
  ownerUserId: string,
  input: DecisionInput,
): Promise<DecisionRecord> {
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({ owner_user_id: ownerUserId, ...input, created_at: now, updated_at: now })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel decision memory belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan keputusan.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "decision",
    entityId: data.id,
    action: "create",
    summary: `Decision created: ${input.title}`,
    after: data,
  });
  return data as DecisionRecord;
}

export async function updateDecision(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
  input: DecisionInput,
): Promise<DecisionRecord> {
  const id = requireUuid(idRaw, "Decision ID");
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Keputusan tidak ditemukan.");
  const { data, error } = await db
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message || "Gagal memperbarui keputusan.");
  if (!data) throw new MentorValidationError("Keputusan tidak ditemukan.");
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "decision",
    entityId: id,
    action: "update",
    summary: `Decision updated: ${input.title}`,
    before,
    after: data,
  });
  return data as DecisionRecord;
}

export async function deleteDecision(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
): Promise<void> {
  const id = requireUuid(idRaw, "Decision ID");
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Keputusan tidak ditemukan.");
  const { error } = await db.from(TABLE).delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new MentorValidationError(error.message || "Gagal menghapus keputusan.");
  await writeAudit(db, {
    ownerUserId,
    businessId: before.business_id,
    entityType: "decision",
    entityId: id,
    action: "delete",
    summary: `Decision deleted: ${before.title}`,
    before,
  });
}
