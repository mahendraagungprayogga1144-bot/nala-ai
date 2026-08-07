/**
 * Trend Analyzer — M5 structure for bias.
 * Phase 1 stub: returns unknown until swing logic is implemented.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, TrendAnalysis } from "../types";

export function analyzeTrend(
  candles: Candle[],
  config: TradingAiConfig,
): TrendAnalysis {
  const notes: string[] = [];
  if (candles.length < config.brain.minM5Candles) {
    notes.push(
      `Need at least ${config.brain.minM5Candles} M5 candles (got ${candles.length}).`,
    );
    return {
      timeframe: config.trendTimeframe,
      direction: "unknown",
      strength: 0,
      notes,
    };
  }

  // TODO(phase-2): swing HH/HL vs LH/LL price-action structure on M5.
  notes.push("Trend Analyzer scaffold — price-action structure not implemented yet.");
  return {
    timeframe: config.trendTimeframe,
    direction: "unknown",
    strength: 0,
    notes,
  };
}
