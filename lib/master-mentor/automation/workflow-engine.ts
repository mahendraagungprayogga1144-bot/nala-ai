import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { writeAudit } from "../audit";
import { MentorValidationError } from "../types";
import { cleanText, isMissingTable, requireUuid } from "../text";
import { automationIdempotencyKey } from "./idempotency";
import type { WorkflowRecord, WorkflowRun, WorkflowTrigger } from "./types";

const WF = "module_master_mentor_workflows";
const RUNS = "module_master_mentor_workflow_runs";

export function createAutomationAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function listWorkflows(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ rows: WorkflowRecord[]; notice: string | null }> {
  const { data, error } = await db
    .from(WF)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error, WF)) {
      return { rows: [], notice: "Tabel workflows belum aktif. Jalankan migration Phase 6." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as WorkflowRecord[], notice: null };
}

export async function listWorkflowRuns(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ rows: WorkflowRun[]; notice: string | null }> {
  const { data, error } = await db
    .from(RUNS)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingTable(error, RUNS)) {
      return { rows: [], notice: "Tabel workflow runs belum aktif." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as WorkflowRun[], notice: null };
}

export type WorkflowInput = {
  name: string;
  description: string;
  trigger_type: WorkflowTrigger;
  schedule_cron: string | null;
  business_id: string | null;
  conditions: Record<string, unknown>;
  actions: unknown[];
  enabled: boolean;
  require_approval: boolean;
};

export function parseWorkflowInput(body: unknown): WorkflowInput {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const trigger = cleanText(raw.trigger_type, 40) as WorkflowTrigger;
  if (!["scheduled", "data_change", "business_event", "manual"].includes(trigger)) {
    throw new MentorValidationError("trigger_type tidak valid.");
  }
  const name = cleanText(raw.name, 120);
  if (!name) throw new MentorValidationError("Nama workflow wajib.");
  const biz = cleanText(raw.business_id, 80);
  return {
    name,
    description: cleanText(raw.description, 2000),
    trigger_type: trigger,
    schedule_cron: cleanText(raw.schedule_cron, 80) || null,
    business_id: biz ? requireUuid(raw.business_id, "Business ID") : null,
    conditions:
      raw.conditions && typeof raw.conditions === "object"
        ? (raw.conditions as Record<string, unknown>)
        : {},
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    enabled: raw.enabled !== false,
    require_approval: raw.require_approval !== false,
  };
}

export async function upsertWorkflow(
  db: SupabaseClient,
  ownerUserId: string,
  input: WorkflowInput,
  id?: string,
): Promise<WorkflowRecord> {
  const payload = {
    owner_user_id: ownerUserId,
    ...input,
    timezone: "Asia/Jakarta",
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { data, error } = await db
      .from(WF)
      .update(payload)
      .eq("id", id)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new MentorValidationError(error?.message || "Gagal update workflow.");
    return data as WorkflowRecord;
  }
  const { data, error } = await db
    .from(WF)
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, WF)) {
      throw new MentorValidationError("Tabel workflows belum aktif. Jalankan migration Phase 6.");
    }
    throw new MentorValidationError(error.message || "Gagal membuat workflow.");
  }
  await writeAudit(db, {
    ownerUserId,
    businessId: input.business_id,
    entityType: "workflow",
    entityId: data.id,
    action: "create",
    summary: `Workflow ${input.name}`,
    after: data,
  });
  return data as WorkflowRecord;
}

/**
 * Begin a run with idempotency. Returns existing run if key already used (prevents double cron).
 */
export async function beginWorkflowRun(
  db: SupabaseClient,
  opts: {
    ownerUserId: string;
    workflowId?: string | null;
    triggerType: string;
    idempotencyKey: string;
  },
): Promise<{ run: WorkflowRun; duplicate: boolean }> {
  const key = opts.idempotencyKey || automationIdempotencyKey([opts.ownerUserId, opts.triggerType, String(Date.now())]);
  const insert = await db
    .from(RUNS)
    .insert({
      owner_user_id: opts.ownerUserId,
      workflow_id: opts.workflowId || null,
      idempotency_key: key,
      trigger_type: opts.triggerType,
      status: "running",
      attempt: 1,
      logs: [{ at: new Date().toISOString(), message: "run_started" }],
    })
    .select("*")
    .maybeSingle();

  if (!insert.error && insert.data) {
    return { run: insert.data as WorkflowRun, duplicate: false };
  }

  // Unique violation → duplicate prevention
  const existing = await db
    .from(RUNS)
    .select("*")
    .eq("owner_user_id", opts.ownerUserId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (existing.data) {
    return { run: existing.data as WorkflowRun, duplicate: true };
  }
  throw new MentorValidationError(insert.error?.message || "Gagal memulai workflow run.");
}

export async function finishWorkflowRun(
  db: SupabaseClient,
  ownerUserId: string,
  runId: string,
  status: WorkflowRun["status"],
  result?: Record<string, unknown>,
  error?: string,
) {
  await db
    .from(RUNS)
    .update({
      status,
      finished_at: new Date().toISOString(),
      result: result || null,
      error: error || null,
      logs: [{ at: new Date().toISOString(), message: `finished_${status}` }],
    })
    .eq("id", runId)
    .eq("owner_user_id", ownerUserId);
}

export async function listOwnerIdsForAutomation(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from("module_master_mentor_businesses")
    .select("owner_user_id")
    .limit(5000);
  if (error || !data) return [];
  return [...new Set(data.map((r) => String(r.owner_user_id)).filter(Boolean))];
}
