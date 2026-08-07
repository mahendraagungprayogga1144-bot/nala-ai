/**
 * Trend Analyzer — M5 swing structure (HH/HL vs LH/LL).
 * Price action only — no RSI/MACD/EMA as primary bias.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, TrendAnalysis, TrendDirection } from "../types";
import { findSwings, lastSwings } from "./price-action";

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

  const swings = findSwings(candles, config.brain.swingLeft, config.brain.swingRight);
  const highs = lastSwings(swings, "high", 3);
  const lows = lastSwings(swings, "low", 3);

  if (highs.length < 2 || lows.length < 2) {
    notes.push("Not enough confirmed swings for structure.");
    return {
      timeframe: config.trendTimeframe,
      direction: "unknown",
      strength: 0,
      notes,
    };
  }

  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;

  let direction: TrendDirection = "ranging";
  let strength = 0.35;

  if (hh && hl) {
    direction = "bullish";
    strength = 0.7;
    notes.push("M5 structure: higher high + higher low → bullish (BUY bias only).");
    if (highs.length >= 3 && highs[highs.length - 2].price > highs[highs.length - 3].price) {
      strength = 0.85;
      notes.push("Third swing continues HH — stronger bullish structure.");
    }
  } else if (lh && ll) {
    direction = "bearish";
    strength = 0.7;
    notes.push("M5 structure: lower high + lower low → bearish (SELL bias only).");
    if (lows.length >= 3 && lows[lows.length - 2].price < lows[lows.length - 3].price) {
      strength = 0.85;
      notes.push("Third swing continues LL — stronger bearish structure.");
    }
  } else {
    notes.push("M5 mixed swings — ranging / unclear. Prefer WAIT.");
  }

  return {
    timeframe: config.trendTimeframe,
    direction,
    strength,
    notes,
  };
}
