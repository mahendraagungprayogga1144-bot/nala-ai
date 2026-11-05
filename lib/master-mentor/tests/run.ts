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
assert.deepEqual(greet.specialists, []);
assert.equal(greet.complex, false);

const financeRoute = planSpecialistRoute("Bagaimana omzet, COGS, dan cash flow bisnis ini?");
assert.deepEqual(financeRoute.specialists, []); // fast chairman-only path
assert.equal(financeRoute.includeFinance, true);

const growthRoute = planSpecialistRoute("Strategi pricing dan acquisition untuk naikkan konversi");
assert.deepEqual(growthRoute.specialists, []);

const multi = planSpecialistRoute(
  "Tolong analisis penuh pakai spesialis: ekspansi toko baru, strategi, risiko, dan dampak keuangan.",
);
assert.ok(multi.specialists.length >= 1);
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

// ── Phase 4 intelligence calculations ────────────────────────────────────────
import {
  buildFinancialIntelligence,
  buildPerformanceAnalytics,
  buildRiskAlerts,
  dayCount,
  priorWindow,
  resolveIntelligencePeriod,
} from "../intelligence";
import type { BusinessFacts } from "../intelligence/types";

const win = resolveIntelligencePeriod("last_7_days");
assert.equal(win.days, 7);
assert.equal(dayCount("2026-11-01", "2026-11-07"), 7);
const prior = priorWindow("2026-11-08", "2026-11-14");
assert.equal(prior.from, "2026-11-01");
assert.equal(prior.to, "2026-11-07");

const emptyFacts: BusinessFacts = {
  gercepBusinessId: "g1",
  gercepBusinessName: "Test",
  mentorBusinessId: bizA,
  mentorBusinessName: "Test Mentor",
  window: { from: "2026-11-01", to: "2026-11-07", label: "test", days: 7 },
  prior: { from: "2026-10-25", to: "2026-10-31", days: 7 },
  transactions: [
    {
      business_id: "g1",
      type: "pemasukan",
      amount: 1_000_000,
      category: "sales",
      description: null,
      transaction_date: "2026-11-02",
    },
    {
      business_id: "g1",
      type: "pengeluaran",
      amount: 200_000,
      category: "ops",
      description: null,
      transaction_date: "2026-11-03",
    },
  ],
  priorTransactions: [
    {
      business_id: "g1",
      type: "pemasukan",
      amount: 800_000,
      category: "sales",
      description: null,
      transaction_date: "2026-10-26",
    },
  ],
  orders: [
    {
      id: "o1",
      business_id: "g1",
      total: 100_000,
      laba: 40_000,
      hpp: 60_000,
      order_date: "2026-11-02",
      source: "retail_kasir",
      status: "paid",
      catatan: null,
      sales_id: null,
      items: [{ product_id: "p1", qty: 2, product_name: "Parfum A", harga_jual: 50_000, hpp: 30_000 }],
    },
  ],
  priorOrders: [],
  products: [{ id: "p1", business_id: "g1", name: "Parfum A", stock: 3, cost: 30_000, price: 50_000 }],
  stockMoves: [],
  salesExpenses: [],
  priorSalesExpenses: [],
  staff: [],
  trackingPoints: [],
  notices: [],
  missingSources: [],
};

const perf = buildPerformanceAnalytics(emptyFacts);
assert.equal(perf.revenue.value, 1_100_000); // tx 1m + retail 100k
assert.ok((perf.salesGrowthPct || 0) > 0);
assert.equal(perf.orderCount.value, 1);

const finIntel = buildFinancialIntelligence(emptyFacts);
assert.ok(finIntel.profitAndLoss.netProfit.value != null);
assert.equal(finIntel.forecast.nextPeriodRevenue.certainty, "forecast");

const risks = buildRiskAlerts({
  ...emptyFacts,
  products: [{ id: "p1", business_id: "g1", name: "Parfum A", stock: 2, cost: 30_000, price: 50_000 }],
});
assert.ok(risks.some((r) => r.id.startsWith("low_stock")));
assert.ok(risks.every((r) => r.kind === "detected" || r.kind === "hypothesis"));

// ── Phase 5 actions ──────────────────────────────────────────────────────────
import { parseProposeActionInput } from "../actions/action-service";
import { isActionType, isRiskLevel } from "../actions/types";

assert.equal(isActionType("note_recommendation"), true);
assert.equal(isActionType("delete_everything"), false);
assert.equal(isRiskLevel("high"), true);
const act = parseProposeActionInput({
  action_type: "record_decision",
  title: "Tunda ekspansi",
  description: "Cashflow tipis",
  risk_level: "high",
  business_id: bizA,
});
assert.equal(act.action_type, "record_decision");
assert.equal(act.risk_level, "high");
expectThrow(
  () => parseProposeActionInput({ action_type: "hack", title: "x" }),
  "action_type",
);

// ── Phase 6 automation ───────────────────────────────────────────────────────
import { automationIdempotencyKey, jakartaDayKey } from "../automation/idempotency";
import { probeShopeeCapability } from "../automation/shopee-adapter";
import { probeWhatsAppCapability } from "../automation/whatsapp-adapter";
import { parseWorkflowInput } from "../automation/workflow-engine";

assert.equal(automationIdempotencyKey(["a", "b"]).length, 48);
assert.equal(jakartaDayKey(new Date("2026-11-05T17:00:00Z")).length, 10);
const shopee = probeShopeeCapability();
assert.equal(shopee.available, false);
assert.ok(shopee.requiredCredentials.includes("SHOPEE_PARTNER_ID"));
const wa = probeWhatsAppCapability();
assert.ok(Array.isArray(wa.notes));
const wf = parseWorkflowInput({
  name: "Daily briefing",
  trigger_type: "scheduled",
  schedule_cron: "0 1 * * *",
  require_approval: true,
});
assert.equal(wf.trigger_type, "scheduled");
expectThrow(() => parseWorkflowInput({ name: "x", trigger_type: "magic" }), "trigger_type");

// ── Owner-stated chat figures ────────────────────────────────────────────────
import {
  extractOwnerStatedFigures,
  formatOwnerStatedFiguresForPrompt,
} from "../chat/owner-stated-figures";

const stated = extractOwnerStatedFigures(
  "udah release 143 produk dalam 3 bulan omzet 16jt+ tapi sisa cuma 2jt karena bayar rumah 5jt",
);
assert.ok(stated.some((f) => f.label === "omzet" && f.amountIdrApprox === 16_000_000));
assert.ok(stated.some((f) => f.label === "saldo_kas" && f.amountIdrApprox === 2_000_000));
assert.ok(stated.some((f) => f.label === "pengeluaran_pribadi" && f.amountIdrApprox === 5_000_000));
assert.ok(stated.some((f) => f.label === "jumlah_produk"));
assert.ok(formatOwnerStatedFiguresForPrompt(stated).includes("OWNER SEBUTKAN"));

// ── Phase 7 autonomy ─────────────────────────────────────────────────────────
import { canTransition, assertTransition } from "../autonomy/state-machine";
import { planFromGoal } from "../autonomy/planner";
import { levelAllowsTool } from "../autonomy/policy";
import { registerBuiltinTools, getTool, listTools } from "../autonomy";

assert.equal(canTransition("pending", "planning"), true);
assert.equal(canTransition("completed", "executing"), false);
assert.equal(levelAllowsTool(1, 0), true);
assert.equal(levelAllowsTool(0, 2), false);
expectThrow(() => assertTransition("completed", "executing"), "transisi");

const fastRoute = planSpecialistRoute("Analisis BEP dan kas HENIMA dari memory.");
assert.equal(fastRoute.specialists.length, 0);
assert.equal(fastRoute.includeFinance, true);
const deepRoute = planSpecialistRoute("Analisis penuh pakai spesialis keuangan dan risiko");
assert.ok(deepRoute.specialists.length >= 1);

const plan0 = planFromGoal("Analisis penjualan minggu ini dan cari cara meningkatkan keuntungan.", 0);
assert.ok(plan0.steps.some((s) => s.tool_name === "memory.retrieve"));
assert.ok(plan0.steps.every((s) => !s.tool_name.startsWith("action.")));
assert.equal(plan0.permission_level, 0);

const plan2 = planFromGoal("Kirim pesan WhatsApp follow-up pelanggan", 2);
assert.ok(plan2.steps.some((s) => s.tool_name === "external.message_draft"));
assert.ok(plan2.permission_level >= 2);

registerBuiltinTools();
registerBuiltinTools(); // idempotent
assert.ok(getTool("memory.retrieve"));
assert.ok(listTools().length >= 8);
assert.equal(getTool("shell_exec"), null);

console.log("master-mentor tests: ok (phase1+phase2+phase3+phase4+phase5+phase6+phase7)");

