import { computeAdvertising } from "./engines/advertising";
import { computeAffiliateFees } from "./engines/affiliate";
import { computeCost, computeVariableCost } from "./engines/cost";
import { decide } from "./engines/decision";
import { computePlatformFees } from "./engines/fee";
import {
  buildBreakdown,
  computeAov,
  computeBeRoas,
  computeContributionProfit,
  computeGrossProfit,
  computeNetMargin,
  computeNetProfit,
  computeTarget,
} from "./engines/profit";
import { computeRevenue } from "./engines/revenue";
import { computeAdRoi, computeBusinessRoi } from "./engines/roi";
import { asNumber, todayISO } from "./money";
import type { ProfitCalcInput, ProfitCalcResult } from "./types";
import { assertValidInput } from "./validation";

export function calculateProfit(input: ProfitCalcInput): ProfitCalcResult {
  assertValidInput(input);
  const as_of = input.as_of || todayISO();
  const currency = input.currency || "IDR";
  const warnings: string[] = [];

  const revenue = computeRevenue(input);
  const cost = computeCost(input);
  const { order_variable_cost, other_variable_cost } = computeVariableCost(input);
  const { platform_fees, applied_fees } = computePlatformFees(input, revenue, as_of);
  const { affiliate_fees, applied_affiliates } = computeAffiliateFees(input, revenue, as_of);
  const advertising = computeAdvertising(input);

  const gross_profit = computeGrossProfit(revenue.net_revenue, cost.cogs);
  const contribution_profit = computeContributionProfit({
    net_revenue: revenue.net_revenue,
    cogs: cost.cogs,
    platform_fees,
    affiliate_fees,
    order_variable_cost,
    other_variable_cost,
  });

  if (contribution_profit <= 0) warnings.push("NOT PROFITABLE BEFORE ADS");

  const max_ad_cost = contribution_profit;
  const target = computeTarget(input, revenue.net_revenue, contribution_profit);
  if (!target.target_margin_achievable) warnings.push("TARGET MARGIN NOT ACHIEVABLE");

  const be_roas = computeBeRoas(revenue.net_revenue, contribution_profit);
  const allocated_fixed_cost = asNumber(input.allocated_fixed_cost);
  const net_profit = computeNetProfit(contribution_profit, advertising.ad_spend, allocated_fixed_cost);
  const net_margin = computeNetMargin(net_profit, revenue.net_revenue);
  const invested_capital = asNumber(input.invested_capital);
  const business_roi =
    revenue.net_revenue <= 0 ? null : computeBusinessRoi(net_profit, invested_capital);
  const ad_roi =
    revenue.net_revenue <= 0 ? null : computeAdRoi(net_profit + allocated_fixed_cost, advertising.ad_spend);
  const aov = computeAov(revenue.net_revenue, asNumber(input.quantity));

  const decision = decide({
    contribution_profit,
    net_profit,
    roas: advertising.roas,
    be_roas,
    target_roas: target.target_roas,
    product_name: input.product_name,
  });

  const breakdown = buildBreakdown({
    revenue,
    cost,
    platform_fees,
    affiliate_fees,
    order_variable_cost,
    other_variable_cost,
    contribution_profit,
    ad_spend: advertising.ad_spend,
    allocated_fixed_cost,
    net_profit,
  });

  return {
    currency,
    as_of,
    product_name: input.product_name,
    sku: input.sku || "",
    marketplace: input.marketplace,
    quantity: asNumber(input.quantity),
    selling_price: asNumber(input.selling_price),
    revenue,
    cost,
    platform_fees,
    applied_fees,
    affiliate_fees,
    applied_affiliates,
    order_variable_cost,
    other_variable_cost,
    variable: input.variable,
    gross_profit,
    contribution_profit,
    max_ad_cost,
    target_net_margin_pct: asNumber(input.target_net_margin_pct),
    target_profit: target.target_profit,
    max_ad_cost_for_target: target.max_ad_cost_for_target,
    target_margin_achievable: target.target_margin_achievable,
    be_roas,
    target_roas: target.target_roas,
    advertising,
    allocated_fixed_cost,
    net_profit,
    net_margin,
    invested_capital,
    business_roi,
    ad_roi,
    aov,
    decision,
    breakdown,
    warnings,
  };
}

export type SimulatorKnobs = {
  selling_price: number;
  discount_pct: number;
  affiliate_rate: number;
  platform_fee_rate: number;
  hpp: number;
  target_net_margin_pct: number;
  ad_cost: number;
};

/** Rebuild a calculator input from realtime simulator knobs, keeping other rules intact. */
export function applySimulatorKnobs(base: ProfitCalcInput, knobs: SimulatorKnobs): ProfitCalcInput {
  const sellerDiscounts = base.discounts.filter((d) => d.funded_by === "SELLER");
  const otherDiscounts = base.discounts.filter((d) => d.funded_by !== "SELLER");
  const nextSeller: ProfitCalcInput["discounts"] =
    sellerDiscounts.length > 0
      ? sellerDiscounts.map((d, i) => (i === 0 ? { ...d, percentage: knobs.discount_pct, amount: 0 } : d))
      : [{ name: "Discount", amount: 0, percentage: knobs.discount_pct, funded_by: "SELLER" }];

  const platformRules = base.fee_rules.map((r, i) =>
    i === 0 ? { ...r, rate: knobs.platform_fee_rate } : r,
  );
  const affiliateRules = base.affiliate_rules.map((r, i) =>
    i === 0 ? { ...r, rate: knobs.affiliate_rate } : r,
  );

  const currentHpp =
    base.costs.material_cost +
    base.costs.bottle_cost +
    base.costs.packaging_cost +
    base.costs.box_cost +
    base.costs.label_cost +
    base.costs.labor_cost +
    base.costs.other_cost;
  const scale = currentHpp > 0 ? knobs.hpp / currentHpp : 1;

  return {
    ...base,
    selling_price: knobs.selling_price,
    discounts: [...nextSeller, ...otherDiscounts],
    costs:
      currentHpp > 0
        ? {
            material_cost: base.costs.material_cost * scale,
            bottle_cost: base.costs.bottle_cost * scale,
            packaging_cost: base.costs.packaging_cost * scale,
            box_cost: base.costs.box_cost * scale,
            label_cost: base.costs.label_cost * scale,
            labor_cost: base.costs.labor_cost * scale,
            other_cost: base.costs.other_cost * scale,
          }
        : { ...base.costs, material_cost: knobs.hpp },
    fee_rules: platformRules,
    affiliate_rules: affiliateRules.length
      ? affiliateRules
      : [
          {
            affiliate_type: "STANDARD",
            rate: knobs.affiliate_rate,
            calculation_base: "NET_REVENUE",
            effective_from: "2020-01-01",
            active: true,
          },
        ],
    target_net_margin_pct: knobs.target_net_margin_pct,
    advertising: {
      ...base.advertising,
      ad_spend: knobs.ad_cost,
      attributed_revenue: base.advertising.attributed_revenue || knobs.selling_price,
    },
  };
}

export function simulateAdCostCurve(base: ProfitCalcInput, points = 12): { ad_cost: number; net_profit: number }[] {
  const max = Math.max(1000, base.advertising.ad_spend * 3, 100000);
  const out: { ad_cost: number; net_profit: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const ad_cost = Math.round((max * i) / points);
    const r = calculateProfit({
      ...base,
      advertising: { ...base.advertising, ad_spend: ad_cost },
    });
    out.push({ ad_cost, net_profit: r.net_profit });
  }
  return out;
}
