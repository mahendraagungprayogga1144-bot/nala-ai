import type { SupabaseClient } from "@supabase/supabase-js";
import { createDecision } from "../decision-memory-service";
import { createFinancialRecord, parseFinancialInput } from "../financial-memory-service";
import { createLearning } from "../learning-memory-service";
import { createStrategy } from "../strategy-memory-service";
import type { MemoryCandidate } from "../memory-types";
import { MentorValidationError } from "../types";
import { cleanText } from "../text";

/**
 * Promote an approved memory candidate into canonical memory tables.
 * Only called after owner approval. Never invents fields.
 */
export async function promoteApprovedCandidate(
  db: SupabaseClient,
  ownerUserId: string,
  candidate: MemoryCandidate,
): Promise<{ kind: string; id: string | null; detail: string }> {
  const payload = (candidate.proposed_payload || {}) as Record<string, unknown>;
  const kind = candidate.memory_kind;

  if (kind === "decision") {
    if (!candidate.business_id) {
      throw new MentorValidationError("Decision candidate membutuhkan business_id.");
    }
    const row = await createDecision(db, ownerUserId, {
      business_id: candidate.business_id,
      title: cleanText(payload.title || "Keputusan dari Mentor", 200) || "Keputusan dari Mentor",
      description: cleanText(payload.description, 4000),
      reasoning: cleanText(payload.reasoning, 4000),
      alternatives: cleanText(payload.alternatives, 4000),
      expected_outcome: cleanText(payload.expected_outcome, 4000),
      risks: cleanText(payload.risks, 4000),
      decision_date: cleanText(payload.decision_date, 20) || new Date().toISOString().slice(0, 10),
      status: "proposed",
      actual_outcome: "",
      review_notes: cleanText(`Dipromosikan dari candidate ${candidate.id}`, 4000),
    });
    return { kind, id: row.id, detail: "Decision memory created from approved candidate." };
  }

  if (kind === "strategy") {
    if (!candidate.business_id) {
      throw new MentorValidationError("Strategy candidate membutuhkan business_id.");
    }
    const row = await createStrategy(db, ownerUserId, {
      business_id: candidate.business_id,
      title: cleanText(payload.title || "Strategi dari Mentor", 200) || "Strategi dari Mentor",
      business_strategy: cleanText(
        payload.business_strategy || payload.plan || payload.description,
        4000,
      ),
      short_term_targets: cleanText(payload.short_term_targets, 4000),
      medium_term_targets: cleanText(payload.medium_term_targets, 4000),
      long_term_targets: cleanText(payload.long_term_targets, 4000),
      growth_plans: cleanText(payload.growth_plans, 4000),
      expansion_plans: cleanText(payload.expansion_plans, 4000),
      marketing_strategies: cleanText(payload.marketing_strategies, 4000),
      operational_strategies: cleanText(payload.operational_strategies, 4000),
      milestones: cleanText(payload.milestones || payload.kpis, 4000),
      status: "draft",
    });
    return { kind, id: row.id, detail: "Strategy memory created from approved candidate." };
  }

  if (kind === "learning") {
    if (!candidate.business_id) {
      throw new MentorValidationError("Learning candidate membutuhkan business_id.");
    }
    const lesson =
      cleanText(payload.lesson || payload.description || payload.title, 4000) ||
      "Pembelajaran dari Mentor";
    const row = await createLearning(db, ownerUserId, {
      business_id: candidate.business_id,
      related_decision_id: null,
      lesson,
      evidence: cleanText(payload.evidence || payload.context, 4000),
      source: "mentor_candidate_approved",
      recorded_date: cleanText(payload.recorded_date, 20) || new Date().toISOString().slice(0, 10),
    });
    return { kind, id: row.id, detail: "Learning memory created from approved candidate." };
  }

  if (kind === "financial") {
    if (!candidate.business_id) {
      throw new MentorValidationError("Financial candidate membutuhkan business_id.");
    }
    const input = parseFinancialInput({
      ...payload,
      business_id: candidate.business_id,
      data_source: "mentor_candidate_approved",
      certainty: payload.certainty || "estimate",
    });
    const row = await createFinancialRecord(db, ownerUserId, input);
    return { kind, id: row.id, detail: "Financial memory created from approved candidate." };
  }

  return {
    kind,
    id: candidate.id,
    detail: `Candidate ${kind} marked approved. Canonical profile merge for this kind remains manual in Memory UI (safety).`,
  };
}
