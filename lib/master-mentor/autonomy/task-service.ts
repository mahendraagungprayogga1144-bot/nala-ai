import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { assertOwnedBusiness } from "../ownership";
import { cleanText, isMissingTable, requireText } from "../text";
import { MentorValidationError } from "../types";
import { writeAudit } from "../audit";
import { planFromGoal } from "./planner";
import { getAutonomySettings } from "./settings-service";
import { assertTransition, isTerminal } from "./state-machine";
import {
  isAutonomyLevel,
  type AutoStep,
  type AutoTask,
  type AutonomyLevel,
  type TaskPriority,
  type TaskStatus,
} from "./types";

const TASKS = "module_master_mentor_auto_tasks";
const STEPS = "module_master_mentor_auto_steps";

export function makeTaskIdempotencyKey(ownerUserId: string, goal: string, businessId?: string | null) {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update([ownerUserId, businessId || "", goal.trim().toLowerCase().slice(0, 400), day].join("|"))
    .digest("hex")
    .slice(0, 48);
}

export async function listAutoTasks(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { status?: string; businessId?: string } = {},
): Promise<{ rows: AutoTask[]; notice: string | null }> {
  let q = db
    .from(TASKS)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.businessId) {
    await assertOwnedBusiness(db, ownerUserId, opts.businessId);
    q = q.eq("business_id", opts.businessId);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error, TASKS)) {
      return { rows: [], notice: "Tabel auto tasks belum aktif. Jalankan migration Phase 7." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as AutoTask[], notice: null };
}

export async function getAutoTask(
  db: SupabaseClient,
  ownerUserId: string,
  taskId: string,
): Promise<{ task: AutoTask | null; steps: AutoStep[]; notice: string | null }> {
  const { data, error } = await db
    .from(TASKS)
    .select("*")
    .eq("id", taskId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, TASKS)) {
      return { task: null, steps: [], notice: "Tabel auto tasks belum aktif. Jalankan migration Phase 7." };
    }
    return { task: null, steps: [], notice: error.message };
  }
  if (!data) return { task: null, steps: [], notice: null };
  const steps = await db
    .from(STEPS)
    .select("*")
    .eq("task_id", taskId)
    .eq("owner_user_id", ownerUserId)
    .order("step_index", { ascending: true });
  return {
    task: data as AutoTask,
    steps: (steps.data || []) as AutoStep[],
    notice: steps.error?.message || null,
  };
}

export async function createAutoTask(
  db: SupabaseClient,
  ownerUserId: string,
  raw: {
    goal: string;
    business_id?: string | null;
    priority?: TaskPriority;
    idempotency_key?: string;
  },
): Promise<{ task: AutoTask; steps: AutoStep[]; duplicate: boolean }> {
  const goal = requireText(raw.goal, "Goal", 2000);
  const businessId = raw.business_id ? cleanText(raw.business_id, 80) : null;
  if (businessId) await assertOwnedBusiness(db, ownerUserId, businessId);

  const { row: settings } = await getAutonomySettings(db, ownerUserId);
  if (settings.emergency_stop) {
    throw new MentorValidationError("Emergency stop aktif. Nonaktifkan dulu di Permission Settings.");
  }

  const { rows: active } = await listAutoTasks(db, ownerUserId);
  const running = active.filter((t) =>
    ["pending", "planning", "waiting_approval", "approved", "executing", "verifying", "paused"].includes(
      t.status,
    ),
  );
  if (running.length >= settings.max_concurrent_tasks) {
    throw new MentorValidationError(
      `Batas concurrent tasks (${settings.max_concurrent_tasks}). Selesaikan atau batalkan task aktif dulu.`,
    );
  }

  const key = raw.idempotency_key || makeTaskIdempotencyKey(ownerUserId, goal, businessId);
  const plan = planFromGoal(goal, settings.autonomy_level as AutonomyLevel);

  const insert = await db
    .from(TASKS)
    .insert({
      owner_user_id: ownerUserId,
      business_id: businessId,
      goal,
      priority: raw.priority || "medium",
      risk_level: plan.risk_level,
      permission_level: plan.permission_level,
      status: "pending",
      plan: { summary: plan.summary, steps: plan.steps },
      idempotency_key: key,
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (insert.error) {
    if (isMissingTable(insert.error, TASKS)) {
      throw new MentorValidationError("Tabel auto tasks belum aktif. Jalankan migration Phase 7.");
    }
    // duplicate idempotency
    const existing = await db
      .from(TASKS)
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing.data) {
      const { steps } = await getAutoTask(db, ownerUserId, existing.data.id);
      return { task: existing.data as AutoTask, steps, duplicate: true };
    }
    throw new MentorValidationError(insert.error.message || "Gagal membuat task.");
  }

  const task = insert.data as AutoTask;
  const stepRows = plan.steps.map((s, i) => ({
    owner_user_id: ownerUserId,
    task_id: task.id,
    step_index: i,
    title: s.title,
    tool_name: s.tool_name,
    specialist: s.specialist || "",
    status: "pending",
    input: s.input || {},
  }));

  const { data: steps, error: stepErr } = await db.from(STEPS).insert(stepRows).select("*");
  if (stepErr) {
    throw new MentorValidationError(stepErr.message || "Gagal menyimpan langkah task.");
  }

  await writeAudit(db, {
    ownerUserId,
    businessId,
    entityType: "auto_task",
    entityId: task.id,
    action: "create",
    summary: `Task dibuat: ${goal.slice(0, 120)}`,
    after: task,
  });

  return { task, steps: (steps || []) as AutoStep[], duplicate: false };
}

export async function transitionTask(
  db: SupabaseClient,
  ownerUserId: string,
  taskId: string,
  to: TaskStatus,
  patch: Partial<{ result: Record<string, unknown>; error_log: string; plan: Record<string, unknown> }> = {},
): Promise<AutoTask> {
  const { task } = await getAutoTask(db, ownerUserId, taskId);
  if (!task) throw new MentorValidationError("Task tidak ditemukan.");
  if (isTerminal(task.status) && to !== "pending") {
    throw new MentorValidationError(`Task sudah terminal (${task.status}).`);
  }
  assertTransition(task.status, to);

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: to,
    updated_at: now,
  };
  if (patch.result !== undefined) update.result = patch.result;
  if (patch.error_log !== undefined) update.error_log = patch.error_log;
  if (patch.plan !== undefined) update.plan = patch.plan;
  if (to === "planning" || to === "executing") update.started_at = task.started_at || now;
  if (["completed", "failed", "cancelled", "rejected", "expired"].includes(to)) {
    update.finished_at = now;
  }

  const { data, error } = await db
    .from(TASKS)
    .update(update)
    .eq("id", taskId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error || !data) throw new MentorValidationError(error?.message || "Gagal update status task.");
  return data as AutoTask;
}

export async function updateStep(
  db: SupabaseClient,
  ownerUserId: string,
  stepId: string,
  patch: Partial<AutoStep>,
): Promise<AutoStep> {
  const { data, error } = await db
    .from(STEPS)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", stepId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .maybeSingle();
  if (error || !data) throw new MentorValidationError(error?.message || "Gagal update step.");
  return data as AutoStep;
}

export function parseCreateTaskBody(body: unknown) {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const goal = requireText(raw.goal, "Goal", 2000);
  const business_id = cleanText(raw.business_id, 80) || null;
  const priority = (["low", "medium", "high", "critical"] as const).includes(raw.priority as TaskPriority)
    ? (raw.priority as TaskPriority)
    : "medium";
  return { goal, business_id, priority };
}

export function parseSettingsBody(body: unknown) {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const out: {
    autonomy_level?: AutonomyLevel;
    emergency_stop?: boolean;
    allowed_level3_tools?: string[];
    max_concurrent_tasks?: number;
    notes?: string;
  } = {};
  if (raw.autonomy_level !== undefined) {
    const n = Number(raw.autonomy_level);
    if (!isAutonomyLevel(n)) throw new MentorValidationError("autonomy_level harus 0–3.");
    out.autonomy_level = n;
  }
  if (typeof raw.emergency_stop === "boolean") out.emergency_stop = raw.emergency_stop;
  if (Array.isArray(raw.allowed_level3_tools)) {
    out.allowed_level3_tools = raw.allowed_level3_tools.map(String);
  }
  if (raw.max_concurrent_tasks !== undefined) {
    out.max_concurrent_tasks = Number(raw.max_concurrent_tasks);
  }
  if (raw.notes !== undefined) out.notes = String(raw.notes);
  return out;
}
