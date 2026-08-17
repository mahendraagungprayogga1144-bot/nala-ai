/**
 * Dynamic take-profit distance for scalping (price units on XAUUSD).
 * Bands map roughly to ~10–15 / 15–30 / >30 pips when 1 pip ≈ 0.10 price.
 */

export type DynamicTpInput = {
  marketPrice: number;
  riskDistance: number;
  m5Strength: number;
  momentumStrength: number;
  baseRr: number;
};

/**
 * Returns take-profit price offset from entry (always positive distance).
 */
export function dynamicTakeProfitDistance(input: DynamicTpInput): number {
  const { marketPrice, riskDistance, m5Strength, momentumStrength, baseRr } = input;
  const risk = Math.max(riskDistance, marketPrice * 0.0005, 0.05);

  // Combined quality 0..1
  const quality = Math.max(0, Math.min(1, m5Strength * 0.55 + momentumStrength * 0.45));

  let rr = baseRr;
  if (quality < 0.55) rr = Math.min(baseRr, 1.0); // ~weak → tighter TP
  else if (quality < 0.75) rr = baseRr; // normal
  else rr = Math.max(baseRr, 2.0); // strong → allow larger target

  // Soft pip bands in price (XAU ≈ $0.10 per pip for many brokers' display)
  const minDist = 1.0; // ~10 pips
  const midCap = 3.0; // ~30 pips soft preference
  let dist = risk * rr;
  if (quality < 0.75) dist = Math.min(dist, midCap);
  // Strong momentum may exceed 30-pip equivalent
  if (quality >= 0.85) dist = Math.max(dist, midCap * 1.05);
  return Math.max(minDist, dist);
}
