import { asNumber, inEffectiveWindow, roundMoney } from "../money";
import type {
  AppliedFee,
  CalculationBase,
  FeeRuleInput,
  ProfitCalcInput,
  RevenueResult,
} from "../types";

export function resolveBase(
  base: CalculationBase,
  revenue: RevenueResult,
  extras?: Partial<Record<CalculationBase, number>>,
): number {
  if (base === "GROSS_REVENUE") return revenue.gross_revenue;
  if (base === "NET_REVENUE") return revenue.net_revenue;
  if (base === "ITEM_REVENUE") return extras?.ITEM_REVENUE ?? revenue.net_revenue;
  if (base === "SHIPPING_REVENUE") return extras?.SHIPPING_REVENUE ?? 0;
  return extras?.OTHER ?? 0;
}

export function pickActiveRules<T extends { active: boolean; effective_from: string; effective_until?: string | null }>(
  rules: T[],
  asOf: string,
): T[] {
  return rules.filter((r) => r.active && inEffectiveWindow(asOf, r.effective_from, r.effective_until));
}

export function applyFeeRule(
  rule: FeeRuleInput,
  revenue: RevenueResult,
  extras?: Partial<Record<CalculationBase, number>>,
): AppliedFee {
  const base_amount = resolveBase(rule.calculation_base, revenue, extras);
  const amount = roundMoney((base_amount * asNumber(rule.rate)) / 100 + asNumber(rule.fixed_fee));
  return {
    fee_name: rule.fee_name,
    program_name: rule.program_name,
    rate: asNumber(rule.rate),
    fixed_fee: asNumber(rule.fixed_fee),
    calculation_base: rule.calculation_base,
    base_amount,
    amount,
  };
}

export function computePlatformFees(
  input: ProfitCalcInput,
  revenue: RevenueResult,
  asOf: string,
): { platform_fees: number; applied_fees: AppliedFee[] } {
  const rules = pickActiveRules(input.fee_rules, asOf).filter((r) => {
    if (!input.marketplace) return true;
    return r.platform.toLowerCase() === input.marketplace.toLowerCase() || r.platform === "*";
  });
  const applied_fees = rules.map((r) => applyFeeRule(r, revenue, input.other_bases));
  const platform_fees = roundMoney(applied_fees.reduce((s, f) => s + f.amount, 0));
  return { platform_fees, applied_fees };
}
