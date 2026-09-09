import { asNumber, roundMoney } from "../money";
import { applyFeeRule, pickActiveRules } from "./fee";
import type { AppliedFee, ProfitCalcInput, RevenueResult } from "../types";

export function computeAffiliateFees(
  input: ProfitCalcInput,
  revenue: RevenueResult,
  asOf: string,
): { affiliate_fees: number; applied_affiliates: AppliedFee[] } {
  const rules = pickActiveRules(input.affiliate_rules, asOf);
  const applied_affiliates = rules.map((r) =>
    applyFeeRule(
      {
        platform: input.marketplace,
        fee_name: r.affiliate_name || `Affiliate ${r.affiliate_type}`,
        rate: asNumber(r.rate),
        fixed_fee: 0,
        calculation_base: r.calculation_base,
        program_name: r.affiliate_type,
        effective_from: r.effective_from,
        effective_until: r.effective_until,
        active: r.active,
      },
      revenue,
      input.other_bases,
    ),
  );
  const affiliate_fees = roundMoney(applied_affiliates.reduce((s, f) => s + f.amount, 0));
  return { affiliate_fees, applied_affiliates };
}
