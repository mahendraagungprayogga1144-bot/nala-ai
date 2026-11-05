import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "../audit";
import { createDecision } from "../decision-memory-service";
import { createFinancialRecord, parseFinancialInput } from "../financial-memory-service";
import { createLearning } from "../learning-memory-service";
import { createStrategy } from "../strategy-memory-service";
import { MentorValidationError } from "../types";
import { cleanText } from "../text";
import type { MentorAction } from "./types";

async function logExecution(
  db: SupabaseClient,
  ownerUserId: string,
  actionId: string,
  status: "success" | "failed" | "skipped",
  detail: string,
  result?: Record<string, unknown>,
) {
  await db.from("module_master_mentor_action_executions").insert({
    owner_user_id: ownerUserId,
    action_id: actionId,
    attempt: 1,
    status,
    detail: cleanText(detail, 2000),
    result: result || null,
  });
}

/**
 * Execute a single approved action. Sensitive external sends stay drafts only (Phase 6).
 * Approval of action A never authorizes action B.
 */
export async function executeApprovedAction(
  db: SupabaseClient,
  ownerUserId: string,
  action: MentorAction,
): Promise<MentorAction> {
  if (action.status !== "approved") {
    throw new MentorValidationError("Hanya aksi berstatus approved yang dapat dieksekusi.");
  }

  try {
    let result: Record<string, unknown> = {};
    let detail = "";

    switch (action.action_type) {
      case "note_recommendation":
      case "inventory_restock_plan":
      case "sales_followup_plan":
      case "external_message_draft": {
        // Persist as executed plan/draft — no operational side effects in Phase 5
        detail = `${action.action_type} dicatat sebagai rencana/draft. Tidak mengubah data operasional Gercep.`;
        result = { recorded: true, payload: action.payload };
        break;
      }
      case "record_decision": {
        if (!action.business_id) throw new MentorValidationError("business_id wajib untuk record_decision.");
        const p = action.payload;
        const row = await createDecision(db, ownerUserId, {
          business_id: action.business_id,
          title: cleanText(p.title || action.title, 200) || action.title,
          description: cleanText(p.description || action.description, 4000),
          reasoning: cleanText(p.reasoning, 4000),
          alternatives: cleanText(p.alternatives, 4000),
          expected_outcome: cleanText(p.expected_outcome || action.expected_impact, 4000),
          risks: cleanText(p.risks, 4000),
          decision_date: cleanText(p.decision_date, 20) || new Date().toISOString().slice(0, 10),
          status: "proposed",
          actual_outcome: "",
          review_notes: `Executed from action ${action.id}`,
        });
        result = { decision_id: row.id };
        detail = "Decision memory created.";
        break;
      }
      case "record_strategy": {
        if (!action.business_id) throw new MentorValidationError("business_id wajib untuk record_strategy.");
        const p = action.payload;
        const row = await createStrategy(db, ownerUserId, {
          business_id: action.business_id,
          title: cleanText(p.title || action.title, 200) || action.title,
          business_strategy: cleanText(p.business_strategy || action.description, 4000),
          short_term_targets: cleanText(p.short_term_targets, 4000),
          medium_term_targets: cleanText(p.medium_term_targets, 4000),
          long_term_targets: cleanText(p.long_term_targets, 4000),
          growth_plans: cleanText(p.growth_plans, 4000),
          expansion_plans: cleanText(p.expansion_plans, 4000),
          marketing_strategies: cleanText(p.marketing_strategies, 4000),
          operational_strategies: cleanText(p.operational_strategies, 4000),
          milestones: cleanText(p.milestones, 4000),
          status: "draft",
        });
        result = { strategy_id: row.id };
        detail = "Strategy memory created.";
        break;
      }
      case "record_learning": {
        if (!action.business_id) throw new MentorValidationError("business_id wajib untuk record_learning.");
        const p = action.payload;
        const row = await createLearning(db, ownerUserId, {
          business_id: action.business_id,
          related_decision_id: null,
          lesson: cleanText(p.lesson || action.description || action.title, 4000) || action.title,
          evidence: cleanText(p.evidence, 4000),
          source: "mentor_candidate_approved",
          recorded_date: new Date().toISOString().slice(0, 10),
        });
        result = { learning_id: row.id };
        detail = "Learning memory created.";
        break;
      }
      case "financial_memory_write": {
        if (!action.business_id) {
          throw new MentorValidationError("business_id wajib untuk financial_memory_write.");
        }
        const input = parseFinancialInput({
          ...action.payload,
          business_id: action.business_id,
          data_source: "mentor_candidate_approved",
          certainty: action.payload.certainty || "estimate",
        });
        const row = await createFinancialRecord(db, ownerUserId, input);
        result = { financial_id: row.id };
        detail = "Financial memory written.";
        break;
      }
      case "memory_candidate_promote": {
        detail = "Gunakan Approval Center → Memory Candidates untuk promote kandidat memori.";
        result = { deferred: true };
        break;
      }
      default:
        throw new MentorValidationError(`Tipe aksi tidak didukung: ${action.action_type}`);
    }

    const now = new Date().toISOString();
    const { data: executed, error } = await db
      .from("module_master_mentor_actions")
      .update({
        status: "executed",
        executed_at: now,
        execution_result: result,
        updated_at: now,
      })
      .eq("id", action.id)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();
    if (error || !executed) {
      throw new MentorValidationError(error?.message || "Gagal memperbarui status eksekusi.");
    }
    await logExecution(db, ownerUserId, action.id, "success", detail, result);
    await writeAudit(db, {
      ownerUserId,
      businessId: action.business_id,
      entityType: "mentor_action",
      entityId: action.id,
      action: "update",
      summary: `Action executed: ${detail}`,
      after: executed,
    });
    return executed as MentorAction;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Execution failed";
    const now = new Date().toISOString();
    const { data: failed } = await db
      .from("module_master_mentor_actions")
      .update({
        status: "failed",
        executed_at: now,
        execution_result: { error: msg },
        updated_at: now,
      })
      .eq("id", action.id)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();
    await logExecution(db, ownerUserId, action.id, "failed", msg, { error: msg });
    if (failed) return failed as MentorAction;
    throw err instanceof MentorValidationError ? err : new MentorValidationError(msg);
  }
}

export async function listExecutions(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ rows: Record<string, unknown>[]; notice: string | null }> {
  const { data, error } = await db
    .from("module_master_mentor_action_executions")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { rows: [], notice: "Tabel executions belum aktif. Jalankan migration Phase 5." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as Record<string, unknown>[], notice: null };
}
