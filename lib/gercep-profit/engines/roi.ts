import { asNumber, roundRatio, safeDiv } from "../money";

/** Business ROI uses invested capital, never ad-attributed ROAS. */
export function computeBusinessRoi(netProfit: number, investedCapital: number): number | null {
  const capital = asNumber(investedCapital);
  if (capital <= 0) return null;
  const r = safeDiv(netProfit, capital);
  return r == null ? null : roundRatio(r * 100, 4);
}

/**
 * Ad ROI is profit created by ads relative to ad spend.
 * Distinct from ROAS (revenue / spend).
 */
export function computeAdRoi(netProfitFromAds: number, adSpend: number): number | null {
  if (adSpend <= 0) return null;
  const r = safeDiv(netProfitFromAds, adSpend);
  return r == null ? null : roundRatio(r * 100, 4);
}
