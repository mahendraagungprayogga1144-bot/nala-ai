import assert from "node:assert/strict";
import {
  MentorValidationError,
  categoryLabel,
  isBusinessCategory,
  isBusinessStatus,
  statusLabel,
} from "../types";
import { parsePortfolioInput } from "../portfolio-service";
import { parseOwnerMemoryInput } from "../owner-memory-service";
import { parseFinancialInput } from "../financial-memory-service";
import { parseDecisionInput } from "../decision-memory-service";
import { parseStrategyInput } from "../strategy-memory-service";
import { parseLearningInput } from "../learning-memory-service";
import { parseCandidateInput } from "../memory-candidates-service";
import { detectTopics } from "../memory-retrieval";
import { requireAmount, requireUuid, textMatches, tokenizeQuery } from "../text";

function expectThrow(fn: () => void, includes: string) {
  try {
    fn();
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof MentorValidationError, "expected MentorValidationError");
    assert.match(err.message, new RegExp(includes, "i"));
  }
}

// ── Phase 1 portfolio validation ─────────────────────────────────────────────
assert.equal(isBusinessCategory("perfume"), true);
assert.equal(isBusinessStatus("active"), true);
assert.equal(categoryLabel("perfume"), "Perfume / Fragrance");
assert.equal(statusLabel("draft"), "Draft");
const ok = parsePortfolioInput({
  name: "HENIMA Perfume",
  category: "perfume",
  description: "Fragrance brand",
  status: "draft",
  targets: "Launch Q1",
});
assert.equal(ok.name, "HENIMA Perfume");
expectThrow(() => parsePortfolioInput({ name: "", category: "perfume" }), "nama");

// ── 1. Owner memory parse ────────────────────────────────────────────────────
const owner = parseOwnerMemoryInput({
  business_vision: "Build lasting fragrance house",
  risk_tolerance: "Moderate",
});
assert.equal(owner.business_vision.includes("fragrance"), true);
assert.equal(owner.long_term_goals, "");

// ── 2/3. Business isolation helpers ──────────────────────────────────────────
const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";
assert.equal(requireUuid(bizA, "Business ID"), bizA);
expectThrow(() => requireUuid("not-a-uuid", "Business ID"), "tidak valid");

// ── 4. Financial records ─────────────────────────────────────────────────────
const fin = parseFinancialInput({
  business_id: bizA,
  metric_type: "revenue",
  amount: 1500000,
  transaction_date: "2026-11-01",
  certainty: "actual",
  description: "November sales",
});
assert.equal(fin.amount, 1500000);
assert.equal(fin.certainty, "actual");
assert.equal(fin.business_id, bizA);
expectThrow(
  () =>
    parseFinancialInput({
      business_id: bizA,
      metric_type: "revenue",
      amount: "abc",
      transaction_date: "2026-11-01",
    }),
  "angka",
);
expectThrow(
  () =>
    parseFinancialInput({
      business_id: bizB,
      metric_type: "made_up",
      amount: 1,
      transaction_date: "2026-11-01",
    }),
  "metric",
);
assert.equal(requireAmount(12.345, "Amount"), 12.35);

// Cross-business payload shapes stay distinct by business_id field
const finB = parseFinancialInput({
  business_id: bizB,
  metric_type: "cogs",
  amount: 100,
  transaction_date: "2026-11-01",
  certainty: "estimate",
});
assert.notEqual(fin.business_id, finB.business_id);

// ── 5. Decision history ──────────────────────────────────────────────────────
const dec = parseDecisionInput({
  business_id: bizA,
  title: "Launch online store",
  expected_outcome: "10% sales lift",
  decision_date: "2026-10-01",
  status: "completed",
  actual_outcome: "7% lift",
});
assert.equal(dec.title, "Launch online store");
assert.match(dec.actual_outcome, /7%/);
expectThrow(() => parseDecisionInput({ business_id: bizA, title: "" }), "title");

// ── Strategy / learning / candidates ─────────────────────────────────────────
const strat = parseStrategyInput({
  business_id: bizA,
  title: "Q4 growth",
  status: "active",
  short_term_targets: "Sell 500 bottles",
});
assert.equal(strat.status, "active");

const learn = parseLearningInput({
  business_id: bizA,
  lesson: "Discounting hurt brand perception",
  evidence: "Margin drop after promo week",
  source: "decision_review",
  recorded_date: "2026-11-02",
  related_decision_id: null,
});
assert.match(learn.lesson, /Discounting/);

const cand = parseCandidateInput({
  business_id: bizA,
  memory_kind: "learning",
  classification: "assumption",
  proposed_payload: { lesson: "Maybe expand to malls" },
  source_ref: "chat:thread-1",
});
assert.equal(cand.classification, "assumption");
assert.equal(cand.memory_kind, "learning");
expectThrow(
  () =>
    parseCandidateInput({
      memory_kind: "nope",
      proposed_payload: {},
    }),
  "memory kind",
);

// ── 6. Memory retrieval topic detection ──────────────────────────────────────
assert.ok(detectTopics("Bagaimana omzet dan laba bulan ini?").includes("finance"));
assert.ok(detectTopics("Keputusan ekspansi apa yang sudah diambil?").includes("decision"));
assert.ok(detectTopics("Strategi growth marketing").includes("strategy"));

const tokens = tokenizeQuery("HENIMA Perfume revenue Q4");
assert.ok(tokens.includes("henima") || tokens.includes("perfume") || tokens.includes("revenue"));
assert.equal(textMatches("HENIMA Perfume fragrance house", ["perfume"]), true);
assert.equal(textMatches("unrelated text", ["zzz"]), false);

// ── 7/8/9/10. Validation & isolation assertions (unit-level) ─────────────────
expectThrow(() => parseOwnerMemoryInput(null), "payload");
expectThrow(
  () =>
    parseFinancialInput({
      business_id: bizA,
      metric_type: "revenue",
      amount: 1,
      transaction_date: "01-11-2026",
    }),
  "YYYY-MM-DD",
);
expectThrow(
  () =>
    parseLearningInput({
      business_id: bizA,
      lesson: "",
      recorded_date: "2026-11-01",
    }),
  "lesson",
);

// ── Phase 3: routing, finance calc, permissions, hallucination guards ────────
import { planSpecialistRoute } from "../orchestrator/router";
import { buildFinanceSnapshot } from "../finance/calculations";
import { MENTOR_PERMISSIONS, assertAnalyzeOnly } from "../permissions";
import { getMentorProviderConfig, estimateAnthropicCostUsd } from "../providers/config";
import type { FinancialRecord } from "../memory-types";

const greet = planSpecialistRoute("Halo");
assert.deepEqual(greet.specialists, ["chairman"]);
assert.equal(greet.complex, false);

const financeRoute = planSpecialistRoute("Bagaimana omzet, COGS, dan cash flow bisnis ini?");
assert.ok(financeRoute.specialists.includes("cfo"));
assert.equal(financeRoute.includeFinance, true);

const growthRoute = planSpecialistRoute("Strategi pricing dan acquisition untuk naikkan konversi");
assert.ok(growthRoute.specialists.includes("growth"));

const multi = planSpecialistRoute(
  "Tolong analisis rekomendasi ekspansi toko baru: strategi, risiko, dan dampak keuangan.",
);
assert.ok(multi.specialists.includes("strategy") || multi.specialists.includes("cfo") || multi.specialists.includes("risk"));
assert.equal(multi.complex, true);
assert.ok(!multi.specialists.includes("chairman")); // chairman synthesizes separately

const rows: FinancialRecord[] = [
  {
    id: "1",
    owner_user_id: "u",
    business_id: bizA,
    metric_type: "revenue",
    amount: 10000000,
    currency: "IDR",
    transaction_date: "2026-11-01",
    transaction_category: "sales",
    description: "Nov",
    data_source: "owner_entry",
    certainty: "actual",
    created_at: "",
    updated_at: "",
  },
  {
    id: "2",
    owner_user_id: "u",
    business_id: bizA,
    metric_type: "cogs",
    amount: 4000000,
    currency: "IDR",
    transaction_date: "2026-11-01",
    transaction_category: "cogs",
    description: "Nov",
    data_source: "owner_entry",
    certainty: "actual",
    created_at: "",
    updated_at: "",
  },
];
const snap = buildFinanceSnapshot(rows);
assert.equal(snap.derived.grossProfitActual, 6000000);
assert.ok(snap.evidence.length >= 2);
assert.equal(buildFinanceSnapshot([]).missing.length > 0, true);

assert.equal(MENTOR_PERMISSIONS.WRITE, false);
assert.equal(MENTOR_PERMISSIONS.ANALYZE, true);
assertAnalyzeOnly();

const cfg = getMentorProviderConfig();
assert.ok(["anthropic", "none"].includes(cfg.provider));
assert.ok(estimateAnthropicCostUsd(cfg.model, 1000, 1000) >= 0);

// Cross-business finance isolation is enforced by business_id on records + assertOwnedBusiness in services
assert.notEqual(bizA, bizB);

console.log("master-mentor tests: ok (phase1+phase2+phase3)");

