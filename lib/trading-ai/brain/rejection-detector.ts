/**
 * Rejection Detector — thin wrapper over sequenced M1 setup.
 * `nearLevel` kept for signature compatibility; sequence uses SR via decide().
 */

import type { TradingAiConfig } from "../config";
import type { Candle, RejectionAnalysis, TrendDirection } from "../types";
import { detectSequencedSetup } from "./setup-sequence";

export function detectRejection(
  m1Candles: Candle[],
  trendDirection: TrendDirection,
  nearLevelPrice: number | null,
  config: TradingAiConfig,
): RejectionAnalysis {
  const sr = nearLevelPrice
    ? {
        timeframe: config.entryTimeframe,
        levels: [],
        nearestSupport: trendDirection === "bullish" ? nearLevelPrice : null,
        nearestResistance: trendDirection === "bearish" ? nearLevelPrice : null,
      }
    : null;
  return detectSequencedSetup(m1Candles, trendDirection, config, sr).rejection;
}
