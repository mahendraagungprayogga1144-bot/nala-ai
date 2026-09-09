/**
 * Gercep Profit Engine unit tests.
 * Run: npx tsx lib/gercep-profit/tests/run.ts
 */
import assert from "node:assert/strict";
import { calculateProfit, applySimulatorKnobs } from "../calculate";
import {
  DEMO_AS_OF,
  buildDemoDashboard,
  demoCalculatorResult,
  demoCampaigns,
  henimaAfternoonInput,
} from "../demo";
import { cogsPerUnit } from "../engines/cost";
import { pickActiveRules } from "../engines/fee";
import { decide } from "../engines/decision";
import { ProfitEngineError } from "../types";

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log("ok ", name);
  } catch (err) {
    failed += 1;
    console.error("FAIL", name, err instanceof Error ? err.message : err);
  }
}

const unit = calculateProfit(
  henimaAfternoonInput({
    advertising: {
      ad_spend: 6000,
      attributed_revenue: 135000,
      ad_orders: 1,
      clicks: 42,
      impressions: 980,
    },
    invested_capital: 64500,
  }),
);

test("HPP breakdown sums to 64.500", () => {
  const costs = henimaAfternoonInput().costs;
  assert.equal(cogsPerUnit(costs), 64500);
});

test("Henima Afternoon revenue engine", () => {
  assert.equal(unit.revenue.gross_revenue, 150000);
  assert.equal(unit.revenue.seller_discount, 15000);
  assert.equal(unit.revenue.net_revenue, 135000);
  assert.equal(unit.cost.cogs, 64500);
});

test("platform-funded voucher does not reduce seller revenue", () => {
  const r = calculateProfit(
    henimaAfternoonInput({
      vouchers: [{ name: "Platform Voucher", amount: 20000, percentage: 0, funded_by: "PLATFORM" }],
    }),
  );
  assert.equal(r.revenue.net_revenue, 135000);
  assert.equal(r.revenue.platform_funded_discount, 20000);
});

test("seller voucher reduces net revenue", () => {
  const r = calculateProfit(
    henimaAfternoonInput({
      vouchers: [{ name: "Seller Voucher", amount: 5000, percentage: 0, funded_by: "SELLER" }],
    }),
  );
  assert.equal(r.revenue.net_revenue, 130000);
});

test("stacked TikTok fees on net revenue", () => {
  assert.equal(unit.applied_fees.length, 3);
  const byName = Object.fromEntries(unit.applied_fees.map((f) => [f.fee_name, f.amount]));
  assert.equal(byName["Platform Fee"], 10125);
  assert.equal(byName["Dynamic Commission"], 10800);
  assert.equal(byName["Growth Program"], 5400);
  assert.equal(unit.platform_fees, 26325);
  assert.equal(unit.affiliate_fees, 13500);
  assert.equal(unit.order_variable_cost, 2240);
});

test("contribution / BE ROAS / target ROAS", () => {
  assert.equal(unit.contribution_profit, 28435);
  assert.equal(unit.max_ad_cost, 28435);
  assert.equal(unit.be_roas, 4.7477);
  assert.equal(unit.target_profit, 20250);
  assert.equal(unit.max_ad_cost_for_target, 8185);
  assert.equal(unit.target_roas, 16.4936);
  assert.equal(unit.target_margin_achievable, true);
});

test("ROAS is not ROI", () => {
  assert.equal(unit.advertising.roas, 22.5);
  assert.equal(unit.net_profit, 22435);
  assert.equal(unit.net_margin, 16.6185);
  assert.equal(unit.business_roi, 34.7829);
  assert.equal(unit.ad_roi, 373.9167);
  assert.notEqual(unit.advertising.roas, unit.business_roi);
  assert.notEqual(unit.advertising.roas, unit.ad_roi);
});

test("decision SCALE when ROAS >= target and net > 0", () => {
  assert.equal(unit.decision.status, "SCALE");
});

test("decision OPTIMIZE when BE <= ROAS < target", () => {
  const r = calculateProfit(
    henimaAfternoonInput({
      advertising: { ad_spend: 20000, attributed_revenue: 135000, ad_orders: 1, clicks: 80, impressions: 2000 },
    }),
  );
  assert.equal(r.advertising.roas, 6.75);
  assert.ok((r.advertising.roas ?? 0) >= (r.be_roas ?? 0));
  assert.ok((r.advertising.roas ?? 0) < (r.target_roas ?? 99));
  assert.equal(r.decision.status, "OPTIMIZE");
});

test("decision STOP when ROAS < BE ROAS", () => {
  const r = calculateProfit(
    henimaAfternoonInput({
      advertising: { ad_spend: 40000, attributed_revenue: 135000, ad_orders: 1, clicks: 90, impressions: 2500 },
    }),
  );
  assert.ok((r.advertising.roas ?? 99) < (r.be_roas ?? 0));
  assert.equal(r.decision.status, "STOP");
});

test("contribution <= 0 → BE ROAS N/A and PRODUCT NOT PROFITABLE", () => {
  const r = calculateProfit(
    henimaAfternoonInput({
      costs: {
        material_cost: 200000,
        bottle_cost: 0,
        packaging_cost: 0,
        box_cost: 0,
        label_cost: 0,
        labor_cost: 0,
        other_cost: 0,
      },
    }),
  );
  assert.ok(r.contribution_profit <= 0);
  assert.equal(r.be_roas, null);
  assert.equal(r.target_roas, null);
  assert.equal(r.decision.status, "PRODUCT_NOT_PROFITABLE");
  assert.ok(r.warnings.includes("NOT PROFITABLE BEFORE ADS"));
});

test("ad spend 0 → ROAS N/A", () => {
  const r = calculateProfit(henimaAfternoonInput());
  assert.equal(r.advertising.ad_spend, 0);
  assert.equal(r.advertising.roas, null);
  assert.equal(r.ad_roi, null);
});

test("net revenue 0 → ROAS / ROI / margin N/A", () => {
  const r = calculateProfit(
    henimaAfternoonInput({
      selling_price: 0,
      discounts: [],
      advertising: { ad_spend: 10000, attributed_revenue: 0, ad_orders: 1, clicks: 10, impressions: 100 },
      invested_capital: 10000,
    }),
  );
  assert.equal(r.revenue.net_revenue, 0);
  assert.equal(r.advertising.roas, null);
  assert.equal(r.net_margin, null);
  assert.equal(r.business_roi, null);
});

test("fee rules are versioned by order date", () => {
  const sept = pickActiveRules(henimaAfternoonInput().fee_rules, "2026-09-15");
  const oct = pickActiveRules(henimaAfternoonInput().fee_rules, "2026-10-15");
  const septPlatform = sept.find((f) => f.fee_name === "Platform Fee");
  const octPlatform = oct.find((f) => f.fee_name === "Platform Fee");
  assert.equal(septPlatform?.rate, 7.5);
  assert.equal(octPlatform?.rate, 8);
  const rOct = calculateProfit(henimaAfternoonInput({ as_of: "2026-10-15" }));
  const platform = rOct.applied_fees.find((f) => f.fee_name === "Platform Fee");
  assert.equal(platform?.rate, 8);
  assert.equal(platform?.amount, 10800);
});

test("validation rejects negative price and out-of-range fee", () => {
  assert.throws(
    () => calculateProfit(henimaAfternoonInput({ selling_price: -1 })),
    ProfitEngineError,
  );
  assert.throws(
    () =>
      calculateProfit(
        henimaAfternoonInput({
          fee_rules: [
            {
              platform: "TikTok Shop",
              fee_name: "Bad",
              rate: 140,
              fixed_fee: 0,
              calculation_base: "NET_REVENUE",
              effective_from: "2020-01-01",
              active: true,
            },
          ],
        }),
      ),
    ProfitEngineError,
  );
});

test("quantity must be >= 1", () => {
  assert.throws(() => calculateProfit(henimaAfternoonInput({ quantity: 0 })), ProfitEngineError);
});

test("CPA / CTR / CVR", () => {
  assert.equal(unit.advertising.cpa, 6000);
  assert.equal(unit.advertising.ctr, 4.2857);
  assert.equal(unit.advertising.cvr, 2.381);
});

test("demo campaigns produce SCALE / OPTIMIZE / STOP from the engine", () => {
  const [a, b, c] = demoCampaigns();
  assert.equal(a?.result.decision.status, "SCALE");
  assert.equal(b?.result.decision.status, "OPTIMIZE");
  assert.equal(c?.result.decision.status, "STOP");
  assert.ok((a?.result.advertising.roas ?? 0) > 0);
  assert.ok((b?.result.be_roas ?? 0) > 0);
});

test("dashboard totals are engine output, not hardcoded", () => {
  const dash = buildDemoDashboard();
  const expectedQty = dash.campaigns.reduce((s, c) => s + c.result.quantity, 0);
  assert.equal(dash.totals.quantity, expectedQty);
  assert.equal(
    dash.totals.advertising.ad_spend,
    dash.campaigns.reduce((s, c) => s + c.result.advertising.ad_spend, 0),
  );
  assert.equal(dash.totals.revenue.net_revenue, 135000 * expectedQty);
  assert.equal(dash.totals.cost.cogs, 64500 * expectedQty);
});

test("simulator knobs recompute through the engine", () => {
  const base = henimaAfternoonInput();
  const next = applySimulatorKnobs(base, {
    selling_price: 160000,
    discount_pct: 5,
    affiliate_rate: 8,
    platform_fee_rate: 6,
    hpp: 60000,
    target_net_margin_pct: 12,
    ad_cost: 8000,
  });
  const r = calculateProfit(next);
  assert.equal(r.selling_price, 160000);
  assert.equal(r.cost.cogs_per_unit, 60000);
  assert.equal(r.advertising.ad_spend, 8000);
  assert.ok(r.contribution_profit !== unit.contribution_profit);
});

test("decision helper case 4", () => {
  const d = decide({
    contribution_profit: -10,
    net_profit: -10,
    roas: 8,
    be_roas: null,
    target_roas: null,
    product_name: "X",
  });
  assert.equal(d.status, "PRODUCT_NOT_PROFITABLE");
});

test("demo calculator uses the same engine", () => {
  const r = demoCalculatorResult();
  assert.equal(r.as_of, DEMO_AS_OF);
  assert.equal(r.product_name, "Henima Afternoon");
  assert.equal(r.decision.status, "SCALE");
});

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall gercep-profit tests passed");
