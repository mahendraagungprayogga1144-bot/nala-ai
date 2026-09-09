import { asNumber, roundMoney, roundRatio, safeDiv } from "../money";
import type { AdvertisingResult, ProfitCalcInput } from "../types";

export function computeAdvertising(input: ProfitCalcInput): AdvertisingResult {
  const ad_spend = roundMoney(asNumber(input.advertising.ad_spend));
  const attributed_revenue = roundMoney(asNumber(input.advertising.attributed_revenue));
  const ad_orders = asNumber(input.advertising.ad_orders);
  const clicks = asNumber(input.advertising.clicks);
  const impressions = asNumber(input.advertising.impressions);
  const conversions = asNumber(input.advertising.conversions ?? ad_orders);

  const roas =
    ad_spend <= 0 || attributed_revenue <= 0 ? null : roundRatio(attributed_revenue / ad_spend, 4);
  const cpa = ad_orders <= 0 || ad_spend < 0 ? null : safeDiv(ad_spend, ad_orders);
  const cpc = clicks <= 0 ? null : safeDiv(ad_spend, clicks);
  const ctr = impressions <= 0 ? null : roundRatio((clicks / impressions) * 100, 4);
  const cvr = clicks <= 0 ? null : roundRatio((ad_orders / clicks) * 100, 4);

  return {
    ad_spend,
    attributed_revenue,
    ad_orders,
    clicks,
    impressions,
    conversions,
    roas,
    cpa: cpa == null ? null : roundMoney(cpa),
    cpc: cpc == null ? null : roundRatio(cpc, 2),
    ctr,
    cvr,
  };
}
