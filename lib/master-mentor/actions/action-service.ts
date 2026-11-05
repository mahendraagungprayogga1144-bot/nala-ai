import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "../audit";
import { assertOwnedBusiness } from "../ownership";
import { MentorValidationError } from "../types";
import { cleanText, isMissingTable, requireUuid } from "../text";
import {
  ACTION_TYPES,
  RISK_LEVELS,
  isActionType,
  isRiskLevel,
  type ActionType,
  type MentorAction,
  type RiskLevel,
} from "./types";
import { executeApprovedAction } from "./execute-action";

const TABLE = "module_master_mentor_actions";

export type ProposeActionInput = {
  business_id?: string | null;
  conversation_id?: string | null;
  action_type: ActionType;
  title: string;
  description?: string;
  business_context?: string;
  expected_impact?: string;
  risk_level?: RiskLevel;
  requested_permissions?: string[];
  payload?: Record<string, unknown>;
  evidence?: unknown[];
  source?: string;
  expires_in_hours?: number;
};

export function parseProposeActionInput(body: unknown): ProposeActionInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const action_type = cleanText(raw.action_type, 60);
  if (!isActionType(action_type)) {
    throw new MentorValidationError(`action_type tidak valid. Pilih: ${ACTION_TYPES.join(", ")}`);
  }
  const risk = cleanText(raw.risk_level || "medium", 20);
  if (!isRiskLevel(risk)) {
    throw new MentorValidationError(`risk_level tidak valid. Pilih: ${RISK_LEVELS.join(", ")}`);
  }
  const title = cleanText(raw.title, 200);
  if (!title) throw new MentorValidationError("Judul aksi wajib diisi.");
  const biz = cleanText(raw.business_id, 80);
  const conv = cleanText(raw.conversation_id, 80);
  const perms = Array.isArray(raw.requested_permissions)
    ? raw.requested_permissions.map((p) => cleanText(p, 40)).filter(Boolean)
    : ["WRITE"];
  return {
    business_id: biz ? requireUuid(raw.business_id, "Business ID") : null,
    conversation_id: conv || null,
    action_type,
    title,
    description: cleanText(raw.description, 4000),
    business_context: cleanText(raw.business_context, 4000),
    expected_impact: cleanText(raw.expected_impact, 4000),
    risk_level: risk,
    requested_permissions: perms.length ? perms : ["WRITE"],
    payload:
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : {},
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    source: cleanText(raw.source || "mentor", 40) || "mentor",
    expires_in_hours: Math.min(168, Math.max(1, Number(raw.expires_in_hours) || 168)),
  };
}

export async function listActions(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { status?: string; businessId?: string } = {},
): Promise<{ rows: MentorAction[]; notice: string | null }> {
  let q = db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.businessId) {
    await assertOwnedBusiness(db, ownerUserId, opts.businessId);
    q = q.eq("business_id", opts.businessId);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel actions Phase 5 belum aktif. Jalankan migration Phase 5." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as MentorAction[], notice: null };
}

export async function proposeAction(
  db: SupabaseClient,
  ownerUserId: string,
  input: ProposeActionInput,
): Promise<MentorAction> {
  if (input.business_id) await assertOwnedBusiness(db, ownerUserId, input.business_id);
  const hours = input.expires_in_hours || 168;
  const expires = new Date(Date.now() + hours * 3600_000).toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({
      owner_user_id: ownerUserId,
      business_id: input.business_id || null,
      conversation_id: input.conversation_id || null,
      action_type: input.action_type,
      title: input.title,
      description: input.description || "",
      business_context: input.business_context || "",
      expected_impact: input.expected_impact || "",
      risk_level: input.risk_level || "medium",
      requested_permissions: input.requested_permissions || ["WRITE"],
      payload: input.payload || {},
      evidence: input.evidence || [],
      source: input.source || "mentor",
      status: "pending",
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel actions Phase 5 belum aktif. Jalankan migration Phase 5.");
    }
    throw new MentorValidationError(error.message || "Gagal membuat aksi.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "mentor_action",
    entityId: data.id,
    action: "create",
    summary: `Action proposed: ${input.action_type} / ${input.title}`,
    after: data,
  });
  return data as MentorAction;
}

export async function expireStaleActions(db: SupabaseClient, ownerUserId: string) {
  const now = new Date().toISOString();
  await db
    .from(TABLE)
    .update({ status: "expired", updated_at: now })
    .eq("owner_user_id", ownerUserId)
    .eq("status", "pending")
    .lt("expires_at", now);
}

export async function reviewAction(
  db: SupabaseClient,
  ownerUserId: string,
  idRaw: string,
  decision: "approve" | "reject",
  reviewNote = "",
): Promise<MentorAction> {
  await expireStaleActions(db, ownerUserId);
  const id = requireUuid(idRaw, "Action ID");
  const { data: before } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!before) throw new MentorValidationError("Aksi tidak ditemukan.");
  if (before.status !== "pending") {
    throw new MentorValidationError("Hanya aksi pending yang dapat direview. Approval tidak berlaku silang.");
  }
  if (before.expires_at && before.expires_at < new Date().toISOString()) {
    await db
      .from(TABLE)
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_user_id", ownerUserId);
    throw new MentorValidationError("Aksi sudah kedaluwarsa. Ajukan ulang jika masih relevan.");
  }

  if (decision === "reject") {
    const { data, error } = await db
      .from(TABLE)
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        review_note: cleanText(reviewNote, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new MentorValidationError(error?.message || "Gagal menolak aksi.");
    await writeAudit(db, {
      ownerUserId,
      businessId: before.business_id,
      entityType: "mentor_action",
      entityId: id,
      action: "reject",
      summary: "Action rejected",
      before,
      after: data,
    });
    return data as MentorAction;
  }

  // Approve then execute (one approval = this action only)
  const { data: approved, error: apprErr } = await db
    .from(TABLE)
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      review_note: cleanText(reviewNote, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (apprErr || !approved) {
    throw new MentorValidationError(apprErr?.message || "Gagal menyetujui aksi.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: before.business_id,
    entityType: "mentor_action",
    entityId: id,
    action: "approve",
    summary: "Action approved — executing",
    before,
    after: approved,
  });

  return executeApprovedAction(db, ownerUserId, approved as MentorAction);
}
