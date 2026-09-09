import { calculateProfit } from "./calculate";
import type { AffiliateRuleInput, FeeRuleInput, ProfitCalcInput, ProfitCalcResult } from "./types";

/** Demo-only. Every number on the dashboard is computed from this input via the engine. */
export const DEMO_AS_OF = "2026-09-09";

export const DEMO_FEE_RULES: FeeRuleInput[] = [
  {
    id: "fee-platform",
    platform: "TikTok Shop",
    fee_name: "Platform Fee",
    rate: 7.5,
    fixed_fee: 0,
    calculation_base: "NET_REVENUE",
    program_name: "Standard",
    effective_from: "2026-09-01",
    effective_until: "2026-09-30",
    active: true,
  },
  {
    id: "fee-dynamic",
    platform: "TikTok Shop",
    fee_name: "Dynamic Commission",
    rate: 8,
    fixed_fee: 0,
    calculation_base: "NET_REVENUE",
    program_name: "Dynamic",
    effective_from: "2026-09-01",
    effective_until: null,
    active: true,
  },
  {
    id: "fee-growth",
    platform: "TikTok Shop",
    fee_name: "Growth Program",
    rate: 4,
    fixed_fee: 0,
    calculation_base: "NET_REVENUE",
    program_name: "Growth",
    effective_from: "2026-09-01",
    effective_until: null,
    active: true,
  },
  {
    id: "fee-platform-oct",
    platform: "TikTok Shop",
    fee_name: "Platform Fee",
    rate: 8,
    fixed_fee: 0,
    calculation_base: "NET_REVENUE",
    program_name: "Standard",
    effective_from: "2026-10-01",
    effective_until: null,
    active: true,
  },
];

export const DEMO_AFFILIATE_RULES: AffiliateRuleInput[] = [
  {
    id: "aff-standard",
    affiliate_type: "STANDARD",
    affiliate_name: "Affiliate Standard",
    rate: 10,
    calculation_base: "NET_REVENUE",
    effective_from: "2026-01-01",
    active: true,
  },
];

/** HPP lines sum to 64.500 as specified. */
export function henimaAfternoonInput(overrides: Partial<ProfitCalcInput> = {}): ProfitCalcInput {
  return {
    as_of: DEMO_AS_OF,
    currency: "IDR",
    product_name: "Henima Afternoon",
    sku: "HNM-AFT-001",
    marketplace: "TikTok Shop",
    selling_price: 150000,
    quantity: 1,
    discounts: [{ name: "Discount", amount: 0, percentage: 10, funded_by: "SELLER" }],
    vouchers: [],
    costs: {
      material_cost: 28000,
      bottle_cost: 8500,
      packaging_cost: 7000,
      box_cost: 6000,
      label_cost: 3500,
      labor_cost: 8000,
      other_cost: 3500,
    },
    fee_rules: DEMO_FEE_RULES,
    affiliate_rules: DEMO_AFFILIATE_RULES,
    variable: {
      processing_fee: 1250,
      shipping_cost: 990,
      insurance: 0,
      additional_packaging: 0,
      other_variable_cost: 0,
    },
    advertising: {
      ad_spend: 0,
      attributed_revenue: 0,
      ad_orders: 0,
      clicks: 0,
      impressions: 0,
    },
    target_net_margin_pct: 15,
    allocated_fixed_cost: 0,
    invested_capital: 0,
    ...overrides,
  };
}

export type DemoCampaign = {
  id: string;
  name: string;
  product_name: string;
  sku: string;
  marketplace: string;
  input: ProfitCalcInput;
  result: ProfitCalcResult;
};

function campaign(args: {
  id: string;
  name: string;
  quantity: number;
  ad_spend: number;
  clicks: number;
  impressions: number;
  invested_capital: number;
}): DemoCampaign {
  const input = henimaAfternoonInput({
    quantity: args.quantity,
    advertising: {
      ad_spend: args.ad_spend,
      attributed_revenue: 0,
      ad_orders: args.quantity,
      clicks: args.clicks,
      impressions: args.impressions,
    },
    invested_capital: args.invested_capital,
  });
  const attributed = calculateProfit({
    ...input,
    advertising: { ...input.advertising, attributed_revenue: 0 },
  }).revenue.net_revenue;
  input.advertising.attributed_revenue = attributed;
  if (!input.invested_capital) input.invested_capital = input.costs.material_cost; // placeholder, overwritten below
  input.invested_capital = args.invested_capital;
  return {
    id: args.id,
    name: args.name,
    product_name: input.product_name,
    sku: input.sku || "",
    marketplace: input.marketplace,
    input,
    result: calculateProfit(input),
  };
}

/** Three campaigns: SCALE / OPTIMIZE / STOP — ad spend chosen so engine produces each status. */
export function demoCampaigns(): DemoCampaign[] {
  return [
    campaign({
      id: "cmp-01",
      name: "Henima Afternoon — Campaign 01",
      quantity: 80,
      ad_spend: 620000,
      clicks: 4100,
      impressions: 92000,
      invested_capital: 8_000_000,
    }),
    campaign({
      id: "cmp-02",
      name: "Henima Afternoon — Campaign 02",
      quantity: 50,
      ad_spend: 1_088_710,
      clicks: 3600,
      impressions: 74000,
      invested_capital: 6_000_000,
    }),
    campaign({
      id: "cmp-03",
      name: "Henima Afternoon — Campaign 03",
      quantity: 30,
      ad_spend: 1_265_625,
      clicks: 2800,
      impressions: 61000,
      invested_capital: 4_000_000,
    }),
  ];
}

export type DemoDashboard = {
  campaigns: DemoCampaign[];
  totals: ProfitCalcResult;
  daily: { date: string; revenue: number; ad_spend: number; net_profit: number; contribution: number }[];
};

export function aggregateResults(results: ProfitCalcResult[], label = "Portfolio"): ProfitCalcResult {
  const qty = results.reduce((s, r) => s + r.quantity, 0);
  const net = results.reduce((s, r) => s + r.revenue.net_revenue, 0);
  const cogs = results.reduce((s, r) => s + r.cost.cogs, 0);
  const fees = results.reduce((s, r) => s + r.platform_fees, 0);
  const aff = results.reduce((s, r) => s + r.affiliate_fees, 0);
  const variable = results.reduce((s, r) => s + r.order_variable_cost + r.other_variable_cost, 0);
  const ads = results.reduce((s, r) => s + r.advertising.ad_spend, 0);
  const attributed = results.reduce((s, r) => s + r.advertising.attributed_revenue, 0);
  const invested = results.reduce((s, r) => s + r.invested_capital, 0);
  const fixed = results.reduce((s, r) => s + r.allocated_fixed_cost, 0);
  const first = results[0] ?? calculateProfit(henimaAfternoonInput());

  return calculateProfit({
    as_of: first.as_of,
    currency: first.currency,
    product_name: label,
    sku: "PORTFOLIO",
    marketplace: first.marketplace,
    selling_price: qty > 0 ? Math.round(net / qty) : 0,
    quantity: Math.max(1, qty),
    discounts: [],
    vouchers: [],
    costs: {
      material_cost: Math.round(cogs / Math.max(1, qty)),
      bottle_cost: 0,
      packaging_cost: 0,
      box_cost: 0,
      label_cost: 0,
      labor_cost: 0,
      other_cost: 0,
    },
    fee_rules: [],
    affiliate_rules: [],
    variable: {
      processing_fee: Math.round(variable / Math.max(1, qty)),
      shipping_cost: 0,
      insurance: 0,
      additional_packaging: 0,
      other_variable_cost: 0,
    },
    advertising: {
      ad_spend: ads,
      attributed_revenue: attributed,
      ad_orders: results.reduce((s, r) => s + r.advertising.ad_orders, 0),
      clicks: results.reduce((s, r) => s + r.advertising.clicks, 0),
      impressions: results.reduce((s, r) => s + r.advertising.impressions, 0),
    },
    target_net_margin_pct: first.target_net_margin_pct,
    allocated_fixed_cost: fixed,
    invested_capital: invested,
    other_bases: {
      OTHER: 0,
    },
  });
}

/**
 * Portfolio totals must come from the same formulas, not a second aggregator.
 * We reconstruct an equivalent input whose line items match the summed campaigns.
 */
export function demoTotals(campaigns: DemoCampaign[]): ProfitCalcResult {
  const results = campaigns.map((c) => c.result);
  const qty = results.reduce((s, r) => s + r.quantity, 0) || 1;
  const first = campaigns[0]!.input;
  const input: ProfitCalcInput = {
    ...henimaAfternoonInput({
      product_name: "All Products",
      sku: "ALL",
      quantity: qty,
      advertising: {
        ad_spend: results.reduce((s, r) => s + r.advertising.ad_spend, 0),
        attributed_revenue: results.reduce((s, r) => s + r.advertising.attributed_revenue, 0),
        ad_orders: results.reduce((s, r) => s + r.advertising.ad_orders, 0),
        clicks: results.reduce((s, r) => s + r.advertising.clicks, 0),
        impressions: results.reduce((s, r) => s + r.advertising.impressions, 0),
      },
      allocated_fixed_cost: results.reduce((s, r) => s + r.allocated_fixed_cost, 0),
      invested_capital: results.reduce((s, r) => s + r.invested_capital, 0),
      target_net_margin_pct: first.target_net_margin_pct,
    }),
  };
  return calculateProfit(input);
}

export function demoDaily(campaigns: DemoCampaign[]) {
  const days = ["03", "04", "05", "06", "07", "08", "09"];
  const totals = demoTotals(campaigns);
  return days.map((d, i) => {
    const weight = [0.11, 0.13, 0.12, 0.15, 0.16, 0.17, 0.16][i]!;
    return {
      date: `Sep ${d}`,
      revenue: Math.round(totals.revenue.net_revenue * weight),
      ad_spend: Math.round(totals.advertising.ad_spend * weight),
      net_profit: Math.round(totals.net_profit * weight),
      contribution: Math.round(totals.contribution_profit * weight),
    };
  });
}

export function buildDemoDashboard(): DemoDashboard {
  const campaigns = demoCampaigns();
  return {
    campaigns,
    totals: demoTotals(campaigns),
    daily: demoDaily(campaigns),
  };
}

export function demoCalculatorResult(): ProfitCalcResult {
  const input = henimaAfternoonInput({
    advertising: {
      ad_spend: 6000,
      attributed_revenue: 135000,
      ad_orders: 1,
      clicks: 42,
      impressions: 980,
    },
    invested_capital: 64500,
  });
  return calculateProfit(input);
}
