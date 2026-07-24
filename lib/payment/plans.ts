import type { PlanKey } from "./config";
import { UPGRADE_PLANS } from "./config";

/** Monthly (and optional yearly) prices controllable from Admin Settings. */
export type PlanPrices = {
  starter: number;
  pro: number;
  enterprise: number;
  starter_yearly: number;
  pro_yearly: number;
  enterprise_yearly: number;
};

export const DEFAULT_PLAN_PRICES: PlanPrices = {
  starter: UPGRADE_PLANS.starter.price,
  pro: UPGRADE_PLANS.pro.price,
  enterprise: UPGRADE_PLANS.enterprise.price,
  starter_yearly: 400_000,
  pro_yearly: 750_000,
  enterprise_yearly: 1_500_000,
};

export function mergePlanPrices(raw?: Partial<PlanPrices> | null): PlanPrices {
  const n = (v: unknown, fb: number) => {
    const x = typeof v === "number" ? v : Number(v);
    return Number.isFinite(x) && x >= 0 ? Math.round(x) : fb;
  };
  const r = raw || {};
  return {
    starter: n(r.starter, DEFAULT_PLAN_PRICES.starter),
    pro: n(r.pro, DEFAULT_PLAN_PRICES.pro),
    enterprise: n(r.enterprise, DEFAULT_PLAN_PRICES.enterprise),
    starter_yearly: n(r.starter_yearly, DEFAULT_PLAN_PRICES.starter_yearly),
    pro_yearly: n(r.pro_yearly, DEFAULT_PLAN_PRICES.pro_yearly),
    enterprise_yearly: n(r.enterprise_yearly, DEFAULT_PLAN_PRICES.enterprise_yearly),
  };
}

/** Upgrade card data with runtime prices applied. */
export function plansWithPrices(prices?: Partial<PlanPrices> | null) {
  const p = mergePlanPrices(prices);
  return {
    starter: { ...UPGRADE_PLANS.starter, price: p.starter },
    pro: { ...UPGRADE_PLANS.pro, price: p.pro },
    enterprise: { ...UPGRADE_PLANS.enterprise, price: p.enterprise },
  } as typeof UPGRADE_PLANS;
}

export function monthlyPrice(key: PlanKey, prices?: Partial<PlanPrices> | null) {
  const p = mergePlanPrices(prices);
  return p[key];
}
