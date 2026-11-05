import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import {
  FINANCIAL_CERTAINTIES,
  FINANCIAL_METRIC_TYPES,
  FINANCIAL_SOURCES,
  type FinancialRecord,
} from "./memory-types";
import { assertOwnedBusiness } from "./ownership";
import { MentorValidationError } from "./types";
import {
  cleanText,
  isMissingTable,
  optionalEnum,
  requireAmount,
  requireDate,
  requireEnum,
  requireUuid,
} from "./text";

const TABLE = "module_master_mentor_financial_records";

export type FinancialInput = {
  business_id: string;
  metric_type: string;
  amount: number;
  currency: string;
  transaction_date: string;
  transaction_category: string;
  description: string;
  data_source: string;
  certainty: string;
};

export function parseFinancialInput(body: unknown): FinancialInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  return {
    business_id: requireUuid(raw.business_id, "Business ID"),
    metric_type: requireEnum(raw.metric_type, FINANCIAL_METRIC_TYPES, "Metric type"),
    amount: requireAmount(raw.amount, "Amount"),
    currency: cleanText(raw.currency, 8).toUpperCase() || "IDR",
    transaction_date: requireDate(raw.transaction_date, "Transaction date"),
    transaction_category: cleanText(raw.transaction_category, 120),
    description: cleanText(raw.description, 2000),
    data_source: optionalEnum(raw.data_source, FINANCIAL_SOURCES, "owner_entry", "Data source"),
    certainty: optionalEnum(raw.certainty, FINANCIAL_CERTAINTIES, "actual", "Certainty"),
  };
}

export async function listFinancialRecords(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { businessId?: string; q?: string; certainty?: string } = {},
): Promise<{ rows: FinancialRecord[]; notice: string | null }> {
  let query = db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("transaction_date", { ascending: false });
  if (opts.businessId) {
    await assertOwnedBusiness(db, ownerUserId, opts.businessId);
    query = query.eq("business_id", opts.businessId);
  }
  if (opts.certainty) {
    query = query.eq("certainty", requireEnum(opts.certainty, FINANCIAL_CERTAINTIES, "Certainty"));
  }
  const term = cleanText(opts.q, 120);
  if (term) {
    query = query.or(
      `description.ilike.%${term}%,transaction_category.ilike.%${term}%,metric_type.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel financial memory belum aktif. Jalankan migration Phase 2." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as FinancialRecord[], notice: null };
}

export async function createFinancialRecord(
  db: SupabaseClient,
  ownerUserId: string,
  input: FinancialInput,
): Promise<FinancialRecord> {
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({
      owner_user_id: ownerUserId,
      ...input,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel financial memory belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan financial record.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "financial_record",
    entityId: data.id,
    action: "create",
    summary: `Financial ${input.metric_type} ${input.certainty}`,
    after: data,
  });
  return data as FinancialRecord;
}

export async function updateFinancialRecord(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
  input: FinancialInput,
): Promise<FinancialRecord> {
  const id = requireUuid(idRaw, "Record ID");
  await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Financial record tidak ditemukan.");

  const { data, error } = await db
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message || "Gagal memperbarui financial record.");
  if (!data) throw new MentorValidationError("Financial record tidak ditemukan.");
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "financial_record",
    entityId: id,
    action: "update",
    summary: "Financial record updated",
    before,
    after: data,
  });
  return data as FinancialRecord;
}

export async function deleteFinancialRecord(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
): Promise<void> {
  const id = requireUuid(idRaw, "Record ID");
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Financial record tidak ditemukan.");
  const { error } = await db.from(TABLE).delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new MentorValidationError(error.message || "Gagal menghapus financial record.");
  await writeAudit(db, {
    ownerUserId,
    businessId: before.business_id,
    entityType: "financial_record",
    entityId: id,
    action: "delete",
    summary: "Financial record deleted",
    before,
  });
}
