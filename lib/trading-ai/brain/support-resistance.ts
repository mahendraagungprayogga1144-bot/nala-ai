/**
 * Support / Resistance Analyzer — zone detection from swing highs/lows.
 * Phase 1 stub.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, SupportResistanceAnalysis } from "../types";

export function analyzeSupportResistance(
  candles: Candle[],
  config: TradingAiConfig,
  currentPrice: number,
): SupportResistanceAnalysis {
  void currentPrice;
  if (candles.length < config.brain.minM5Candles) {
    return {
      timeframe: config.trendTimeframe,
      levels: [],
      nearestSupport: null,
      nearestResistance: null,
    };
  }

  // TODO(phase-2): cluster swing highs/lows into S/R zones (price action).
  return {
    timeframe: config.trendTimeframe,
    levels: [],
    nearestSupport: null,
    nearestResistance: null,
  };
}
