/**
 * Dynamic take-profit distance for XAUUSD scalping (price units).
 * Bands: ~10–20 / 20–30 / >30 pips when 1 pip ≈ 0.10 price.
 * Cap by room to opposite structure when provided.
 */

export type DynamicTpInput = {
  marketPrice: number;
  riskDistance: number;
  m5Strength: number;
  momentumStrength: number;
  baseRr: number;
  /** Distance to next opposing S/R; null = unknown. */
  roomToStructure?: number | null;
};

/**
 * Returns take-profit price offset from entry (always positive distance).
 */
export function dynamicTakeProfitDistance(input: DynamicTpInput): number {
  const {
    marketPrice,
    riskDistance,
    m5Strength,
    momentumStrength,
    baseRr,
    roomToStructure = null,
  } = input;
  const risk = Math.max(riskDistance, marketPrice * 0.0005, 0.05);
  const quality = Math.max(0, Math.min(1, m5Strength * 0.55 + momentumStrength * 0.45));

  // Price bands ≈ pip bands * 0.10
  const bandNormal = 1.5; // ~15 pips mid of 10–20
  const bandStrong = 2.5; // ~25 pips mid of 20–30
  const bandMax = 3.5; // ~35 pips

  let dist: number;
  if (quality < 0.55) {
    dist = Math.min(Math.max(risk * Math.min(baseRr, 1.0), 1.0), bandNormal);
  } else if (quality < 0.8) {
    dist = Math.min(Math.max(risk * baseRr, 1.5), bandStrong);
  } else if (
    quality >= 0.85 &&
    m5Strength >= 0.7 &&
    momentumStrength >= 0.7 &&
    (roomToStructure == null || roomToStructure >= bandMax)
  ) {
    // >30 pips allowed when momentum sangat kuat + ruang ke S/R lawan.
    dist = Math.min(Math.max(risk * Math.max(baseRr, 2.2), 3.2), bandMax + 1.5);
  } else {
    dist = Math.min(Math.max(risk * baseRr, bandNormal), bandStrong);
  }

  if (roomToStructure != null && roomToStructure > 0) {
    // Leave a little room before structure; never aim through nearby wall.
    dist = Math.min(dist, Math.max(1.0, roomToStructure * 0.85));
  }

  return Math.max(1.0, dist);
}
