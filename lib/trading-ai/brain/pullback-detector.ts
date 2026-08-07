/**
 * Pullback Detector — thin wrapper over sequenced M1 setup.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, PullbackAnalysis, SupportResistanceAnalysis, TrendDirection } from "../types";
import { detectSequencedSetup } from "./setup-sequence";

export function detectPullback(
  m1Candles: Candle[],
  trendDirection: TrendDirection,
  config: TradingAiConfig,
  sr?: SupportResistanceAnalysis | null,
): PullbackAnalysis {
  return detectSequencedSetup(m1Candles, trendDirection, config, sr ?? null).pullback;
}
