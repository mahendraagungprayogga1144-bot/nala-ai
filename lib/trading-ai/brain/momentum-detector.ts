/**
 * Momentum Detector — M1 continuation back in M5 direction after rejection.
 * Phase 1 stub.
 */

import type { Candle, MomentumAnalysis, TrendDirection } from "../types";

export function detectMomentum(
  m1Candles: Candle[],
  trendDirection: TrendDirection,
): MomentumAnalysis {
  if (trendDirection === "unknown" || trendDirection === "ranging") {
    return {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["No M5 bias — momentum not evaluated."],
    };
  }
  if (m1Candles.length < 5) {
    return {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Not enough M1 candles for momentum."],
    };
  }

  // TODO(phase-2): displacement / body expansion in bias direction after rejection.
  return {
    alignedWithTrend: false,
    direction: "unknown",
    strength: 0,
    notes: ["Momentum Detector scaffold — not implemented yet."],
  };
}
