import type { SupabaseClient } from "@supabase/supabase-js";
import { listBusinessMemory } from "./business-memory-service";
import { listDecisions } from "./decision-memory-service";
import { listFinancialRecords } from "./financial-memory-service";
import { listLearnings } from "./learning-memory-service";
import type { MentorContextPack, RetrievalHit } from "./memory-types";
import { getOwnerMemory } from "./owner-memory-service";
import { listStrategies } from "./strategy-memory-service";
import { cleanText, textMatches, tokenizeQuery } from "./text";

const TOPIC_RULES: { topic: string; patterns: RegExp[] }[] = [
  { topic: "finance", patterns: [/revenue|omzet|laba|profit|cost|cash|hutang|utang|keuangan|financial/i] },
  { topic: "decision", patterns: [/keputusan|decision|pilih|alternatif|outcome/i] },
  { topic: "strategy", patterns: [/strategi|strategy|growth|ekspansi|expansion|marketing|milestone/i] },
  { topic: "learning", patterns: [/belajar|lesson|gagal|gagal|learning|evaluasi/i] },
  { topic: "owner", patterns: [/visi|vision|preferensi|risk|filosofi|philosophy|gaya/i] },
  { topic: "business", patterns: [/produk|customer|channel|operasional|model|challenge|bisnis/i] },
];

export function detectTopics(query: string): string[] {
  const found = TOPIC_RULES.filter((r) => r.patterns.some((p) => p.test(query))).map((r) => r.topic);
  return found.length ? found : ["business", "decision", "strategy"];
}

export type RetrieveOpts = {
  query: string;
  businessId?: string | null;
  includeFinance?: boolean;
};

/**
 * Structured memory retrieval for Master Mentor context packing.
 * Uses PostgreSQL filtered queries + keyword match — no pgvector (not installed; not required for Phase 2 structured memory).
 * Never invents missing facts; reports them in `missing`.
 */
export async function retrieveMentorContext(
  db: SupabaseClient,
  ownerUserId: string,
  opts: RetrieveOpts,
): Promise<MentorContextPack> {
  const query = cleanText(opts.query, 1000);
  const tokens = tokenizeQuery(query);
  const topics = detectTopics(query);
  const wantFinance = opts.includeFinance ?? topics.includes("finance");

  const [{ row: owner }, { rows: businesses }, { rows: decisions }, { rows: strategies }, { rows: learnings }] =
    await Promise.all([
      getOwnerMemory(db, ownerUserId),
      listBusinessMemory(db, ownerUserId),
      listDecisions(db, ownerUserId, { businessId: opts.businessId || undefined }),
      listStrategies(db, ownerUserId, { businessId: opts.businessId || undefined }),
      listLearnings(db, ownerUserId, { businessId: opts.businessId || undefined }),
    ]);

  const business =
    (opts.businessId && businesses.find((b) => b.id === opts.businessId)) ||
    businesses.find((b) => textMatches(`${b.name} ${b.description} ${b.products_services}`, tokens)) ||
    businesses[0] ||
    null;

  const businessId = business?.id || opts.businessId || null;

  const financial = wantFinance && businessId
    ? (await listFinancialRecords(db, ownerUserId, { businessId })).rows
    : [];

  const hits: RetrievalHit[] = [];
  const sourcesUsed: string[] = [];
  const missing: string[] = [];

  const ownerBlob = [
    owner.business_vision,
    owner.long_term_goals,
    owner.communication_style,
    owner.decision_preferences,
    owner.business_philosophy,
    owner.risk_tolerance,
    owner.working_preferences,
  ].join(" ");

  if (topics.includes("owner")) {
    if (ownerBlob.trim() && (tokens.length === 0 || textMatches(ownerBlob, tokens))) {
      hits.push({
        kind: "owner",
        id: ownerUserId,
        businessId: null,
        title: "Owner profile",
        excerpt: owner.business_vision || owner.long_term_goals || "Owner preferences on file",
        source: "module_master_mentor_owner_memory",
        updatedAt: owner.updated_at || owner.created_at || "",
      });
      sourcesUsed.push("owner_memory");
    } else {
      missing.push("Owner memory for the requested preference/vision is not available yet.");
    }
  }

  if (business) {
    hits.push({
      kind: "business",
      id: business.id,
      businessId: business.id,
      title: business.name,
      excerpt: business.description || business.business_model || business.current_challenges || "Business profile",
      source: "module_master_mentor_businesses",
      updatedAt: business.updated_at,
    });
    sourcesUsed.push(`business:${business.id}`);
  } else {
    missing.push("No business profile is available in the portfolio yet.");
  }

  const matchedDecisions = decisions
    .filter((d) => !businessId || d.business_id === businessId)
    .filter((d) =>
      textMatches(
        `${d.title} ${d.description} ${d.reasoning} ${d.expected_outcome} ${d.actual_outcome}`,
        tokens,
      ) || tokens.length === 0,
    )
    .slice(0, 8);

  for (const d of matchedDecisions) {
    hits.push({
      kind: "decision",
      id: d.id,
      businessId: d.business_id,
      title: d.title,
      excerpt: d.actual_outcome
        ? `Expected: ${d.expected_outcome || "—"} | Actual: ${d.actual_outcome}`
        : d.expected_outcome || d.description || d.reasoning,
      source: "module_master_mentor_decisions",
      updatedAt: d.updated_at,
    });
  }
  if (matchedDecisions.length) sourcesUsed.push("decisions");
  else if (topics.includes("decision")) missing.push("No related decision history was found.");

  const matchedStrategies = strategies
    .filter((s) => !businessId || s.business_id === businessId)
    .filter((s) =>
      textMatches(
        `${s.title} ${s.business_strategy} ${s.growth_plans} ${s.marketing_strategies} ${s.milestones}`,
        tokens,
      ) || tokens.length === 0,
    )
    .slice(0, 6);
  for (const s of matchedStrategies) {
    hits.push({
      kind: "strategy",
      id: s.id,
      businessId: s.business_id,
      title: s.title,
      excerpt: s.business_strategy || s.short_term_targets || s.status,
      source: "module_master_mentor_strategies",
      updatedAt: s.updated_at,
    });
  }
  if (matchedStrategies.length) sourcesUsed.push("strategies");
  else if (topics.includes("strategy")) missing.push("No strategic plans were found for this query.");

  const matchedLearnings = learnings
    .filter((l) => !businessId || l.business_id === businessId)
    .filter((l) => textMatches(`${l.lesson} ${l.evidence}`, tokens) || tokens.length === 0)
    .slice(0, 6);
  for (const l of matchedLearnings) {
    hits.push({
      kind: "learning",
      id: l.id,
      businessId: l.business_id,
      title: "Learning",
      excerpt: l.lesson,
      source: "module_master_mentor_learnings",
      updatedAt: l.updated_at,
    });
  }
  if (matchedLearnings.length) sourcesUsed.push("learnings");
  else if (topics.includes("learning")) missing.push("No learning records were found.");

  const matchedFinance = financial
    .filter((f) => f.certainty === "actual" || f.certainty === "estimate" || f.certainty === "projection")
    .slice(0, 12);
  for (const f of matchedFinance) {
    hits.push({
      kind: "financial",
      id: f.id,
      businessId: f.business_id,
      title: `${f.metric_type} (${f.certainty})`,
      excerpt: `${f.amount} ${f.currency} on ${f.transaction_date} — ${f.description || f.transaction_category || "owner-entered"}`,
      source: `module_master_mentor_financial_records:${f.data_source}`,
      updatedAt: f.updated_at,
    });
  }
  if (matchedFinance.length) sourcesUsed.push("financial_records");
  else if (wantFinance) {
    missing.push(
      "Financial Memory masih kosong. Pakai angka yang owner sebut di chat sebagai estimate (bukan official). Sarankan simpan ke Catatan Keuangan.",
    );
  }

  return {
    query,
    businessId,
    topics,
    owner: ownerBlob.trim() ? owner : null,
    business,
    decisions: matchedDecisions,
    financial: matchedFinance,
    strategies: matchedStrategies,
    learnings: matchedLearnings,
    hits,
    missing,
    sourcesUsed,
    note:
      "Context assembled from owner-entered memory only. Missing items must be stated as unavailable — never fabricated.",
  };
}
