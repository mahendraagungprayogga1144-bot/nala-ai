/**
 * Pullback Detector — M1 retrace against M5 bias.
 * Phase 1 stub: never claims a pullback.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, PullbackAnalysis, TrendDirection } from "../types";

export function detectPullback(
  m1Candles: Candle[],
  trendDirection: TrendDirection,
  config: TradingAiConfig,
): PullbackAnalysis {
  if (trendDirection === "unknown" || trendDirection === "ranging") {
    return {
      detected: false,
      depth: 0,
      nearLevel: null,
      notes: ["No directional bias — skip pullback hunt."],
    };
  }
  if (m1Candles.length < config.brain.minM1Candles) {
    return {
      detected: false,
      depth: 0,
      nearLevel: null,
      notes: [`Need at least ${config.brain.minM1Candles} M1 candles.`],
    };
  }

  // TODO(phase-2): measure retrace toward nearest S/R in opposite of M5 bias.
  return {
    detected: false,
    depth: 0,
    nearLevel: null,
    notes: ["Pullback Detector scaffold — not implemented yet."],
  };
}
