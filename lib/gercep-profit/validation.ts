import { asNumber } from "./money";
import { CALC_BASES, FUNDED_BY, type ProfitCalcInput, type ValidationIssue } from "./types";
import { ProfitEngineError } from "./types";

function reqNum(issues: ValidationIssue[], field: string, raw: unknown, min = 0) {
  const n = asNumber(raw, Number.NaN);
  if (!Number.isFinite(n)) {
    issues.push({ field, message: `${field} harus berupa angka.` });
    return;
  }
  if (n < min) {
    issues.push({ field, message: `${field} tidak boleh lebih kecil dari ${min}.` });
  }
}

function reqPct(issues: ValidationIssue[], field: string, raw: unknown) {
  const n = asNumber(raw, Number.NaN);
  if (!Number.isFinite(n)) {
    issues.push({ field, message: `${field} harus berupa angka.` });
    return;
  }
  if (n < 0 || n > 100) {
    issues.push({ field, message: `${field} harus antara 0–100%.` });
  }
}

export function validateProfitInput(input: ProfitCalcInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  reqNum(issues, "selling_price", input.selling_price, 0);
  reqNum(issues, "quantity", input.quantity, 1);
  reqNum(issues, "target_net_margin_pct", input.target_net_margin_pct, 0);
  reqPct(issues, "target_net_margin_pct", input.target_net_margin_pct);
  reqNum(issues, "allocated_fixed_cost", input.allocated_fixed_cost, 0);
  reqNum(issues, "invested_capital", input.invested_capital, 0);

  const c = input.costs;
  for (const key of [
    "material_cost",
    "bottle_cost",
    "packaging_cost",
    "box_cost",
    "label_cost",
    "labor_cost",
    "other_cost",
  ] as const) {
    reqNum(issues, key, c[key], 0);
  }

  const v = input.variable;
  for (const key of [
    "processing_fee",
    "shipping_cost",
    "insurance",
    "additional_packaging",
    "other_variable_cost",
  ] as const) {
    reqNum(issues, key, v[key], 0);
  }

  const ads = input.advertising;
  reqNum(issues, "ad_spend", ads.ad_spend, 0);
  reqNum(issues, "attributed_revenue", ads.attributed_revenue, 0);
  reqNum(issues, "ad_orders", ads.ad_orders, 0);
  reqNum(issues, "clicks", ads.clicks, 0);
  reqNum(issues, "impressions", ads.impressions, 0);

  for (const [i, d] of input.discounts.entries()) {
    reqNum(issues, `discounts[${i}].amount`, d.amount, 0);
    reqPct(issues, `discounts[${i}].percentage`, d.percentage);
    if (!FUNDED_BY.includes(d.funded_by)) {
      issues.push({ field: `discounts[${i}].funded_by`, message: "funded_by tidak valid." });
    }
  }
  for (const [i, d] of input.vouchers.entries()) {
    reqNum(issues, `vouchers[${i}].amount`, d.amount, 0);
    reqPct(issues, `vouchers[${i}].percentage`, d.percentage);
    if (!FUNDED_BY.includes(d.funded_by)) {
      issues.push({ field: `vouchers[${i}].funded_by`, message: "funded_by tidak valid." });
    }
  }
  for (const [i, f] of input.fee_rules.entries()) {
    reqPct(issues, `fee_rules[${i}].rate`, f.rate);
    reqNum(issues, `fee_rules[${i}].fixed_fee`, f.fixed_fee, 0);
    if (!CALC_BASES.includes(f.calculation_base)) {
      issues.push({ field: `fee_rules[${i}].calculation_base`, message: "calculation_base tidak valid." });
    }
  }
  for (const [i, f] of input.affiliate_rules.entries()) {
    reqPct(issues, `affiliate_rules[${i}].rate`, f.rate);
    if (!CALC_BASES.includes(f.calculation_base)) {
      issues.push({
        field: `affiliate_rules[${i}].calculation_base`,
        message: "affiliate base tidak valid.",
      });
    }
  }

  if (!input.product_name?.trim()) {
    issues.push({ field: "product_name", message: "Nama produk wajib diisi." });
  }
  if (!input.marketplace?.trim()) {
    issues.push({ field: "marketplace", message: "Marketplace wajib diisi." });
  }

  return issues;
}

export function assertValidInput(input: ProfitCalcInput) {
  const issues = validateProfitInput(input);
  if (issues.length) {
    throw new ProfitEngineError(issues.map((i) => i.message).join(" "), "invalid_input", 400);
  }
}
