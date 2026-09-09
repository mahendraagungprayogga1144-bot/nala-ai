import { asNumber, roundMoney, roundRatio, safeDiv } from "../money";
import type { BreakdownLine, CostResult, ProfitCalcInput, RevenueResult } from "../types";

export function computeGrossProfit(netRevenue: number, cogs: number): number {
  return roundMoney(netRevenue - cogs);
}

export function computeContributionProfit(args: {
  net_revenue: number;
  cogs: number;
  platform_fees: number;
  affiliate_fees: number;
  order_variable_cost: number;
  other_variable_cost: number;
}): number {
  return roundMoney(
    args.net_revenue -
      args.cogs -
      args.platform_fees -
      args.affiliate_fees -
      args.order_variable_cost -
      args.other_variable_cost,
  );
}

export function computeBeRoas(netRevenue: number, contributionProfit: number): number | null {
  if (contributionProfit <= 0) return null;
  if (netRevenue <= 0) return null;
  return roundRatio(netRevenue / contributionProfit, 4);
}

export function computeTarget(input: ProfitCalcInput, netRevenue: number, contribution: number) {
  const pct = asNumber(input.target_net_margin_pct);
  const target_profit = roundMoney((netRevenue * pct) / 100);
  const max_ad_cost_for_target = roundMoney(contribution - target_profit);
  const target_margin_achievable = max_ad_cost_for_target > 0 && netRevenue > 0;
  const target_roas =
    !target_margin_achievable || max_ad_cost_for_target <= 0
      ? null
      : roundRatio(netRevenue / max_ad_cost_for_target, 4);
  return { target_profit, max_ad_cost_for_target, target_margin_achievable, target_roas };
}

export function computeNetProfit(contribution: number, adSpend: number, allocatedFixed: number) {
  return roundMoney(contribution - adSpend - allocatedFixed);
}

export function computeNetMargin(netProfit: number, netRevenue: number): number | null {
  if (netRevenue <= 0) return null;
  return roundRatio((netProfit / netRevenue) * 100, 4);
}

export function computeAov(netRevenue: number, quantity: number): number | null {
  if (quantity <= 0 || netRevenue <= 0) return null;
  return roundMoney(safeDiv(netRevenue, quantity) ?? 0);
}

export function buildBreakdown(args: {
  revenue: RevenueResult;
  cost: CostResult;
  platform_fees: number;
  affiliate_fees: number;
  order_variable_cost: number;
  other_variable_cost: number;
  contribution_profit: number;
  ad_spend: number;
  allocated_fixed_cost: number;
  net_profit: number;
}): BreakdownLine[] {
  const lines: BreakdownLine[] = [
    { key: "net_revenue", label: "Net Revenue", amount: args.revenue.net_revenue, op: "start" },
    { key: "cogs", label: "COGS / HPP", amount: args.cost.cogs, op: "minus" },
    { key: "platform_fees", label: "Platform Fees", amount: args.platform_fees, op: "minus" },
    { key: "affiliate_fees", label: "Affiliate", amount: args.affiliate_fees, op: "minus" },
    { key: "variable", label: "Order Variable Cost", amount: args.order_variable_cost, op: "minus" },
  ];
  if (args.other_variable_cost) {
    lines.push({
      key: "other_variable",
      label: "Other Variable Cost",
      amount: args.other_variable_cost,
      op: "minus",
    });
  }
  lines.push({
    key: "contribution_profit",
    label: "Contribution Profit",
    amount: args.contribution_profit,
    op: "equals",
  });
  lines.push({ key: "ad_spend", label: "Ad Spend", amount: args.ad_spend, op: "minus" });
  if (args.allocated_fixed_cost) {
    lines.push({
      key: "fixed",
      label: "Allocated Fixed Cost",
      amount: args.allocated_fixed_cost,
      op: "minus",
    });
  }
  lines.push({ key: "net_profit", label: "Net Profit", amount: args.net_profit, op: "equals" });
  return lines;
}
