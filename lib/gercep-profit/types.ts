/** Gercep Profit Engine — shared contracts. Formulas live in engines/, never in UI. */

export const FUNDED_BY = ["SELLER", "PLATFORM", "AFFILIATE", "OTHER"] as const;
export type FundedBy = (typeof FUNDED_BY)[number];

export const CALC_BASES = [
  "GROSS_REVENUE",
  "NET_REVENUE",
  "ITEM_REVENUE",
  "SHIPPING_REVENUE",
  "OTHER",
] as const;
export type CalculationBase = (typeof CALC_BASES)[number];

export const AFFILIATE_TYPES = ["STANDARD", "STORE", "CUSTOM"] as const;
export type AffiliateType = (typeof AFFILIATE_TYPES)[number];

export const DECISION_STATUSES = [
  "SCALE",
  "OPTIMIZE",
  "STOP",
  "PRODUCT_NOT_PROFITABLE",
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const PROFIT_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type ProfitRole = (typeof PROFIT_ROLES)[number];

export type Money = number;
export type Ratio = number | null;

export type DiscountLine = {
  name?: string;
  amount: number;
  percentage: number;
  funded_by: FundedBy;
};

export type ProductCostInput = {
  material_cost: number;
  bottle_cost: number;
  packaging_cost: number;
  box_cost: number;
  label_cost: number;
  labor_cost: number;
  other_cost: number;
};

export type FeeRuleInput = {
  id?: string;
  platform: string;
  fee_name: string;
  rate: number;
  fixed_fee: number;
  calculation_base: CalculationBase;
  program_name?: string | null;
  effective_from: string;
  effective_until?: string | null;
  active: boolean;
};

export type AffiliateRuleInput = {
  id?: string;
  affiliate_type: AffiliateType;
  affiliate_name?: string | null;
  affiliate_id?: string | null;
  rate: number;
  calculation_base: CalculationBase;
  effective_from: string;
  effective_until?: string | null;
  active: boolean;
};

export type VariableCostInput = {
  processing_fee: number;
  shipping_cost: number;
  insurance: number;
  additional_packaging: number;
  other_variable_cost: number;
};

export type AdvertisingInput = {
  ad_spend: number;
  attributed_revenue: number;
  ad_orders: number;
  clicks: number;
  impressions: number;
  conversions?: number;
};

export type ProfitCalcInput = {
  as_of?: string;
  currency?: string;
  product_name: string;
  sku?: string;
  marketplace: string;
  selling_price: number;
  quantity: number;
  discounts: DiscountLine[];
  vouchers: DiscountLine[];
  costs: ProductCostInput;
  fee_rules: FeeRuleInput[];
  affiliate_rules: AffiliateRuleInput[];
  variable: VariableCostInput;
  advertising: AdvertisingInput;
  target_net_margin_pct: number;
  allocated_fixed_cost: number;
  invested_capital: number;
  other_bases?: Partial<Record<CalculationBase, number>>;
};

export type AppliedFee = {
  fee_name: string;
  program_name?: string | null;
  rate: number;
  fixed_fee: number;
  calculation_base: CalculationBase;
  base_amount: number;
  amount: number;
};

export type AppliedDiscount = {
  name?: string;
  funded_by: FundedBy;
  percentage: number;
  amount_input: number;
  amount_applied: number;
  reduces_seller_revenue: boolean;
};

export type RevenueResult = {
  gross_revenue: Money;
  seller_discount: Money;
  platform_funded_discount: Money;
  affiliate_funded_discount: Money;
  other_funded_discount: Money;
  seller_voucher: Money;
  net_revenue: Money;
  discounts: AppliedDiscount[];
};

export type CostResult = {
  cogs_per_unit: Money;
  cogs: Money;
  breakdown: ProductCostInput;
};

export type AdvertisingResult = {
  ad_spend: Money;
  attributed_revenue: Money;
  ad_orders: number;
  clicks: number;
  impressions: number;
  conversions: number;
  roas: Ratio;
  cpa: Ratio;
  cpc: Ratio;
  ctr: Ratio;
  cvr: Ratio;
};

export type DecisionResult = {
  status: DecisionStatus;
  label: string;
  message: string;
  recommendation: string;
};

export type BreakdownLine = {
  key: string;
  label: string;
  amount: Money;
  op: "start" | "minus" | "equals";
};

export type ProfitCalcResult = {
  currency: string;
  as_of: string;
  product_name: string;
  sku: string;
  marketplace: string;
  quantity: number;
  selling_price: Money;
  revenue: RevenueResult;
  cost: CostResult;
  platform_fees: Money;
  applied_fees: AppliedFee[];
  affiliate_fees: Money;
  applied_affiliates: AppliedFee[];
  order_variable_cost: Money;
  other_variable_cost: Money;
  variable: VariableCostInput;
  gross_profit: Money;
  contribution_profit: Money;
  max_ad_cost: Money;
  target_net_margin_pct: number;
  target_profit: Money;
  max_ad_cost_for_target: Money;
  target_margin_achievable: boolean;
  be_roas: Ratio;
  target_roas: Ratio;
  advertising: AdvertisingResult;
  allocated_fixed_cost: Money;
  net_profit: Money;
  net_margin: Ratio;
  invested_capital: Money;
  business_roi: Ratio;
  ad_roi: Ratio;
  aov: Ratio;
  decision: DecisionResult;
  breakdown: BreakdownLine[];
  warnings: string[];
};

export type ProfitEngineErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_json";

export class ProfitEngineError extends Error {
  constructor(
    message: string,
    public code: ProfitEngineErrorCode = "invalid_input",
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "ProfitEngineError";
  }
}

export type ValidationIssue = { field: string; message: string };
