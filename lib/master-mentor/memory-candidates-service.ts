import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit";
import {
  MEMORY_CLASSIFICATIONS,
  MEMORY_KINDS,
  type MemoryCandidate,
} from "./memory-types";
import { assertOwnedBusiness } from "./ownership";
import { MentorValidationError } from "./types";
import {
  cleanText,
  isMissingTable,
  optionalEnum,
  requireEnum,
  requireUuid,
} from "./text";

const TABLE = "module_master_mentor_memory_candidates";

export type CandidateInput = {
  business_id: string | null;
  memory_kind: string;
  classification: string;
  proposed_payload: Record<string, unknown>;
  source_ref: string;
};

export function parseCandidateInput(body: unknown): CandidateInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const biz = cleanText(raw.business_id, 80);
  const payload =
    raw.proposed_payload && typeof raw.proposed_payload === "object"
      ? (raw.proposed_payload as Record<string, unknown>)
      : {};
  return {
    business_id: biz ? requireUuid(raw.business_id, "Business ID") : null,
    memory_kind: requireEnum(raw.memory_kind, MEMORY_KINDS, "Memory kind"),
    classification: optionalEnum(
      raw.classification,
      MEMORY_CLASSIFICATIONS,
      "assumption",
      "Classification",
    ),
    proposed_payload: payload,
    source_ref: cleanText(raw.source_ref, 500),
  };
}

export async function listCandidates(
  db: SupabaseClient,
  ownerUserId: string,
  status = "pending",
): Promise<{ rows: MemoryCandidate[]; notice: string | null }> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel memory candidates belum aktif. Jalankan migration Phase 2." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as MemoryCandidate[], notice: null };
}

/** Phase 2 foundation: create a candidate that still needs owner approval. Never auto-commits as fact. */
export async function proposeMemoryCandidate(
  db: SupabaseClient,
  ownerUserId: string,
  input: CandidateInput,
): Promise<MemoryCandidate> {
  if (input.business_id) await assertOwnedBusiness(db, ownerUserId, input.business_id);
  if (input.classification === "fact" || input.classification === "preference") {
    // Still pending — approval required before persistence into canonical memory tables.
  }
  const { data, error } = await db
    .from(TABLE)
    .insert({
      owner_user_id: ownerUserId,
      business_id: input.business_id,
      memory_kind: input.memory_kind,
      classification: input.classification,
      proposed_payload: input.proposed_payload,
      source_ref: input.source_ref,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel memory candidates belum aktif. Jalankan migration Phase 2.");
    }
    throw new MentorValidationError(error.message || "Gagal membuat kandidat memori.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "memory_candidate",
    entityId: data.id,
    action: "create",
    summary: `Candidate proposed (${input.classification}/${input.memory_kind})`,
    after: data,
  });
  return data as MemoryCandidate;
}

export async function reviewCandidate(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
  action: "approve" | "reject" | "correct",
  reviewNote = "",
  correctedPayload?: Record<string, unknown>,
): Promise<MemoryCandidate> {
  const id = requireUuid(idRaw, "Candidate ID");
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Kandidat tidak ditemukan.");
  if (before.status !== "pending") {
    throw new MentorValidationError("Hanya kandidat pending yang dapat direview.");
  }

  const patch: Record<string, unknown> = {
    status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "corrected",
    reviewed_at: new Date().toISOString(),
    review_note: cleanText(reviewNote, 2000),
  };
  if (action === "correct" && correctedPayload) {
    patch.proposed_payload = correctedPayload;
  }

  const { data, error } = await db
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error) throw new MentorValidationError(error.message || "Gagal mereview kandidat.");
  if (!data) throw new MentorValidationError("Kandidat tidak ditemukan.");

  await writeAudit(db, {
    ownerUserId,
    businessId: before.business_id,
    entityType: "memory_candidate",
    entityId: id,
    action,
    summary: `Candidate ${action}`,
    before,
    after: data,
  });

  // Phase 5: approve promotes into canonical memory (one candidate = one promote).
  if (action === "approve" || action === "correct") {
    try {
      const { promoteApprovedCandidate } = await import("./actions/promote-candidate");
      const promoted = await promoteApprovedCandidate(db, ownerUserId, data as MemoryCandidate);
      await writeAudit(db, {
        ownerUserId,
        businessId: before.business_id,
        entityType: "memory_candidate",
        entityId: id,
        action: "update",
        summary: `Promoted to ${promoted.kind}: ${promoted.detail}`,
        after: promoted,
      });
    } catch (err) {
      // Candidate stays approved; promotion failure is audited via thrown message to caller optionally
      const msg = err instanceof Error ? err.message : "promote failed";
      await writeAudit(db, {
        ownerUserId,
        businessId: before.business_id,
        entityType: "memory_candidate",
        entityId: id,
        action: "update",
        summary: `Approve ok but promote failed: ${msg}`,
      });
    }
  }

  return data as MemoryCandidate;
}
