/**
 * Rejection Detector — wick / absorption at S/R after pullback.
 * Phase 1 stub.
 */

import type { Candle, RejectionAnalysis, TrendDirection } from "../types";

export function detectRejection(
  m1Candles: Candle[],
  trendDirection: TrendDirection,
  nearLevel: number | null,
): RejectionAnalysis {
  if (!nearLevel || trendDirection === "unknown" || trendDirection === "ranging") {
    return {
      detected: false,
      side: null,
      atPrice: null,
      notes: ["No level / bias for rejection check."],
    };
  }
  if (m1Candles.length < 3) {
    return {
      detected: false,
      side: null,
      atPrice: null,
      notes: ["Not enough M1 candles for rejection pattern."],
    };
  }

  // TODO(phase-2): pinbar / engulfing / rejection wick vs S/R.
  return {
    detected: false,
    side: null,
    atPrice: null,
    notes: ["Rejection Detector scaffold — not implemented yet."],
  };
}
