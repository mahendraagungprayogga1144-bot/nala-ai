import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTable } from "../text";
import { MentorValidationError } from "../types";
import { getAutonomySettings } from "./settings-service";
import { getTool } from "./tool-registry";
import { registerBuiltinTools } from "./tools/builtin";
import { levelAllowsTool } from "./policy";
import {
  getAutoTask,
  transitionTask,
  updateStep,
} from "./task-service";
import type { AutonomyLevel } from "./types";

const TOOL_RUNS = "module_master_mentor_tool_runs";

async function logToolRun(
  db: SupabaseClient,
  opts: {
    ownerUserId: string;
    taskId?: string | null;
    stepId?: string | null;
    toolName: string;
    permissionLevel: number;
    riskLevel: string;
    status: "success" | "failed" | "blocked" | "skipped";
    input: Record<string, unknown>;
    output?: Record<string, unknown> | null;
    detail?: string;
  },
) {
  try {
    await db.from(TOOL_RUNS).insert({
      owner_user_id: opts.ownerUserId,
      task_id: opts.taskId || null,
      step_id: opts.stepId || null,
      tool_name: opts.toolName,
      permission_level: opts.permissionLevel,
      risk_level: opts.riskLevel,
      status: opts.status,
      input: opts.input,
      output: opts.output || null,
      detail: opts.detail || "",
    });
  } catch (err) {
    console.error("[phase7/tool_run]", err instanceof Error ? err.message : err);
  }
}

/**
 * Run a planned autonomous task through the state machine.
 * Level 2 tools create Phase 5 pending actions and pause at waiting_approval when needed.
 * Never claims COMPLETED without verification of step outputs.
 */
export async function runAutoTask(
  db: SupabaseClient,
  ownerUserId: string,
  taskId: string,
): Promise<{ taskId: string; status: string; summary: string }> {
  registerBuiltinTools();

  const { row: settings } = await getAutonomySettings(db, ownerUserId);
  if (settings.emergency_stop) {
    await transitionTask(db, ownerUserId, taskId, "cancelled", {
      error_log: "Dibatalkan: emergency stop aktif.",
    }).catch(() => null);
    throw new MentorValidationError("Emergency stop aktif.");
  }

  let { task, steps } = await getAutoTask(db, ownerUserId, taskId);
  if (!task) throw new MentorValidationError("Task tidak ditemukan.");
  if (task.status === "expired" || new Date(task.expires_at).getTime() < Date.now()) {
    if (task.status !== "expired") {
      await transitionTask(db, ownerUserId, taskId, "expired", { error_log: "Task kedaluwarsa." });
    }
    throw new MentorValidationError("Task kedaluwarsa.");
  }

  if (task.status === "pending") {
    task = await transitionTask(db, ownerUserId, taskId, "planning");
  }
  if (task.status === "planning" || task.status === "approved") {
    task = await transitionTask(db, ownerUserId, taskId, "executing");
  }
  if (task.status === "paused") {
    throw new MentorValidationError("Task sedang di-pause.");
  }
  if (!["executing", "waiting_approval"].includes(task.status)) {
    return { taskId, status: task.status, summary: `Tidak ada yang dijalankan (status=${task.status}).` };
  }

  if (task.status === "waiting_approval") {
    return {
      taskId,
      status: task.status,
      summary: "Menunggu approval owner di Approval Center untuk langkah Level 2.",
    };
  }

  const results: Record<string, unknown>[] = [];
  let blockedForApproval = false;

  for (const step of steps) {
    if (settings.emergency_stop) {
      await transitionTask(db, ownerUserId, taskId, "cancelled", {
        error_log: "Emergency stop saat eksekusi.",
      });
      throw new MentorValidationError("Emergency stop aktif.");
    }
    if (["completed", "skipped"].includes(step.status)) continue;

    const tool = getTool(step.tool_name);
    if (!tool) {
      await updateStep(db, ownerUserId, step.id, {
        status: "failed",
        error_log: `Tool tidak terdaftar: ${step.tool_name}`,
        finished_at: new Date().toISOString(),
      });
      await logToolRun(db, {
        ownerUserId,
        taskId,
        stepId: step.id,
        toolName: step.tool_name,
        permissionLevel: 0,
        riskLevel: "critical",
        status: "blocked",
        input: step.input,
        detail: "unregistered_tool",
      });
      await transitionTask(db, ownerUserId, taskId, "failed", {
        error_log: `Tool tidak terdaftar: ${step.tool_name}`,
      });
      return { taskId, status: "failed", summary: `Gagal: tool ${step.tool_name} tidak ada di registry.` };
    }

    const ownerLevel = settings.autonomy_level as AutonomyLevel;
    if (!levelAllowsTool(ownerLevel, tool.permissionLevel)) {
      await updateStep(db, ownerUserId, step.id, {
        status: "skipped",
        error_log: `Dilewati: butuh level ${tool.permissionLevel}, owner level ${ownerLevel}`,
        finished_at: new Date().toISOString(),
      });
      await logToolRun(db, {
        ownerUserId,
        taskId,
        stepId: step.id,
        toolName: tool.name,
        permissionLevel: tool.permissionLevel,
        riskLevel: tool.risk,
        status: "skipped",
        input: step.input,
        detail: "owner_level_insufficient",
      });
      results.push({ step: step.title, skipped: true, reason: "permission" });
      continue;
    }

    if (tool.permissionLevel >= 3) {
      const allow = settings.allowed_level3_tools || [];
      if (!allow.includes(tool.name)) {
        await updateStep(db, ownerUserId, step.id, {
          status: "skipped",
          error_log: "Tool level 3 tidak ada di allowlist owner.",
          finished_at: new Date().toISOString(),
        });
        await logToolRun(db, {
          ownerUserId,
          taskId,
          stepId: step.id,
          toolName: tool.name,
          permissionLevel: 3,
          riskLevel: tool.risk,
          status: "blocked",
          input: step.input,
          detail: "not_in_level3_allowlist",
        });
        results.push({ step: step.title, skipped: true, reason: "level3_allowlist" });
        continue;
      }
    }

    await updateStep(db, ownerUserId, step.id, {
      status: "running",
      started_at: new Date().toISOString(),
    });

    try {
      const output = await tool.handler(
        {
          db,
          ownerUserId,
          businessId: task.business_id,
          taskId: task.id,
          stepId: step.id,
        },
        step.input || {},
      );

      const needsWait = tool.requiresApproval || Boolean(output?.status === "pending_approval");
      await updateStep(db, ownerUserId, step.id, {
        status: needsWait ? "waiting_approval" : "completed",
        output,
        linked_action_id: typeof output.actionId === "string" ? output.actionId : null,
        finished_at: new Date().toISOString(),
        error_log: "",
      });
      await logToolRun(db, {
        ownerUserId,
        taskId,
        stepId: step.id,
        toolName: tool.name,
        permissionLevel: tool.permissionLevel,
        riskLevel: tool.risk,
        status: "success",
        input: step.input,
        output,
      });
      results.push({ step: step.title, tool: tool.name, output, needsWait });
      if (needsWait) blockedForApproval = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "step_failed";
      await updateStep(db, ownerUserId, step.id, {
        status: "failed",
        error_log: msg,
        finished_at: new Date().toISOString(),
      });
      await logToolRun(db, {
        ownerUserId,
        taskId,
        stepId: step.id,
        toolName: tool.name,
        permissionLevel: tool.permissionLevel,
        riskLevel: tool.risk,
        status: "failed",
        input: step.input,
        detail: msg,
      });
      await transitionTask(db, ownerUserId, taskId, "failed", { error_log: msg });
      return { taskId, status: "failed", summary: `Step gagal: ${step.title} — ${msg}` };
    }

    if (blockedForApproval) break;
  }

  if (blockedForApproval) {
    const t = await transitionTask(db, ownerUserId, taskId, "waiting_approval", {
      result: { steps: results, note: "Menunggu Approval Center untuk aksi Level 2." },
    });
    return {
      taskId,
      status: t.status,
      summary: "Sebagian langkah selesai. Ada aksi menunggu approval owner.",
    };
  }

  // Verify: all non-skipped steps completed
  const fresh = await getAutoTask(db, ownerUserId, taskId);
  const pending = fresh.steps.filter((s) => !["completed", "skipped"].includes(s.status));
  await transitionTask(db, ownerUserId, taskId, "verifying");

  if (pending.length) {
    await transitionTask(db, ownerUserId, taskId, "failed", {
      error_log: `Verifikasi gagal: ${pending.length} langkah belum selesai.`,
      result: { steps: results },
    });
    return { taskId, status: "failed", summary: "Verifikasi gagal — ada langkah belum selesai." };
  }

  const completed = await transitionTask(db, ownerUserId, taskId, "completed", {
    result: {
      verified: true,
      steps: results,
      completedAt: new Date().toISOString(),
    },
    error_log: "",
  });

  return {
    taskId,
    status: completed.status,
    summary: `Selesai & terverifikasi: ${results.length} langkah.`,
  };
}

export async function cancelAutoTask(db: SupabaseClient, ownerUserId: string, taskId: string) {
  return transitionTask(db, ownerUserId, taskId, "cancelled", {
    error_log: "Dibatalkan owner.",
  });
}

export async function pauseAutoTask(db: SupabaseClient, ownerUserId: string, taskId: string) {
  return transitionTask(db, ownerUserId, taskId, "paused", {
    error_log: "Di-pause owner.",
  });
}

export async function resumeAutoTask(db: SupabaseClient, ownerUserId: string, taskId: string) {
  const { task } = await getAutoTask(db, ownerUserId, taskId);
  if (!task) throw new MentorValidationError("Task tidak ditemukan.");
  if (task.status !== "paused") throw new MentorValidationError("Hanya task paused yang bisa dilanjutkan.");
  await transitionTask(db, ownerUserId, taskId, "pending");
  return runAutoTask(db, ownerUserId, taskId);
}

export async function listToolRuns(db: SupabaseClient, ownerUserId: string, limit = 50) {
  const { data, error } = await db
    .from(TOOL_RUNS)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error, TOOL_RUNS)) return { rows: [], notice: "Tabel tool runs belum aktif." };
    return { rows: [], notice: error.message };
  }
  return { rows: data || [], notice: null };
}
