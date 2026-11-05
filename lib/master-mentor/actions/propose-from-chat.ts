import type { SupabaseClient } from "@supabase/supabase-js";
import { extractOwnerStatedFigures } from "../chat/owner-stated-figures";
import { proposeMemoryCandidate } from "../memory-candidates-service";
import { proposeAction } from "./action-service";
import type { SpecialistBrief } from "../agents/types";

const FIGURE_TO_METRIC: Record<string, string> = {
  omzet: "revenue",
  saldo_kas: "cash_balance",
  laba: "net_profit",
  modal: "investment",
  pengeluaran_pribadi: "operating_expenses",
};

/**
 * After a Mentor Chat turn, propose owner-reviewable actions (Phase 5).
 * Never auto-executes. Caps proposals to avoid spam.
 */
export async function proposeFromChatTurn(
  db: SupabaseClient,
  opts: {
    ownerUserId: string;
    businessId?: string | null;
    conversationId?: string | null;
    question: string;
    reply: string;
    specialists: SpecialistBrief[];
    missing: string[];
    sourcesUsed: string[];
  },
): Promise<{ actionIds: string[]; candidateIds: string[] }> {
  const actionIds: string[] = [];
  const candidateIds: string[] = [];
  const reply = (opts.reply || "").trim();
  if (reply.length < 80) return { actionIds, candidateIds };

  const ran = opts.specialists.filter((s) => s.ran).map((s) => s.id);
  const excerpt = reply.slice(0, 900);
  const figures = extractOwnerStatedFigures(opts.question);

  try {
    const action = await proposeAction(db, opts.ownerUserId, {
      business_id: opts.businessId || null,
      conversation_id: opts.conversationId || null,
      action_type: "note_recommendation",
      title: `Rekomendasi Mentor: ${opts.question.slice(0, 80)}`,
      description: excerpt,
      business_context: `Specialists: ${ran.join(", ") || "chairman"}`,
      expected_impact: "Menunggu keputusan owner — belum dieksekusi ke sistem operasional.",
      risk_level: ran.includes("risk") || ran.includes("cfo") ? "medium" : "low",
      requested_permissions: ["WRITE"],
      payload: {
        question: opts.question.slice(0, 500),
        specialists: ran,
        missing: opts.missing.slice(0, 8),
      },
      evidence: opts.sourcesUsed.slice(0, 12),
      source: "mentor",
      expires_in_hours: 168,
    });
    actionIds.push(action.id);
  } catch {
    /* table may be missing — ignore */
  }

  // Structured decision candidate when strategy/risk/cfo involved and business selected
  if (opts.businessId && (ran.includes("strategy") || ran.includes("risk") || ran.includes("cfo"))) {
    try {
      const cand = await proposeMemoryCandidate(db, opts.ownerUserId, {
        business_id: opts.businessId,
        memory_kind: "decision",
        classification: "recommendation",
        proposed_payload: {
          title: opts.question.slice(0, 120) || "Keputusan dari konsultasi Mentor",
          description: excerpt,
          reasoning: `Dihasilkan dari Mentor Chat. Spesialis: ${ran.join(", ") || "chairman"}.`,
          expected_outcome: "",
          risks: opts.missing.slice(0, 5).join("; "),
          decision_date: new Date().toISOString().slice(0, 10),
        },
        source_ref: `conversation:${opts.conversationId || "new"}`,
      });
      candidateIds.push(cand.id);
    } catch {
      /* ignore */
    }
  }

  // Financial figures typed in chat → pending candidates (owner must approve)
  if (opts.businessId) {
    const today = new Date().toISOString().slice(0, 10);
    for (const fig of figures.slice(0, 4)) {
      const metric = FIGURE_TO_METRIC[fig.label];
      if (!metric || fig.amountIdrApprox == null) continue;
      try {
        const cand = await proposeMemoryCandidate(db, opts.ownerUserId, {
          business_id: opts.businessId,
          memory_kind: "financial",
          classification: "assumption",
          proposed_payload: {
            metric_type: metric,
            amount: fig.amountIdrApprox,
            currency: "IDR",
            certainty: "estimate",
            transaction_date: today,
            description: `Dari chat owner: ${fig.raw}`,
            transaction_category: fig.label,
            data_source: "owner_stated_in_chat",
          },
          source_ref: `conversation:${opts.conversationId || "new"}:fig:${fig.label}`,
        });
        candidateIds.push(cand.id);
      } catch {
        /* ignore */
      }
    }
  }

  return { actionIds, candidateIds };
}
