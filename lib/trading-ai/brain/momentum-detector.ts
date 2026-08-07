/**
 * Momentum Detector — prefers sequenced setup when config+SR available via decide().
 * Standalone call without sequence context stays conservative.
 */

import type { Candle, MomentumAnalysis, TrendDirection } from "../types";
import { bodySize, isBearishCandle, isBullishCandle, lastClosedIndex } from "./price-action";

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

  const closed = lastClosedIndex(m1Candles);
  const window = m1Candles.slice(Math.max(0, closed - 2), closed + 1);
  if (window.length < 2) {
    return {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Momentum window too short."],
    };
  }

  const bullishCount = window.filter(isBullishCandle).length;
  const bearishCount = window.filter(isBearishCandle).length;
  const avgBody = window.reduce((s, c) => s + bodySize(c), 0) / window.length;
  const lastBody = bodySize(window[window.length - 1]);
  const expanding = lastBody >= avgBody * 0.85;
  const last = window[window.length - 1];
  const first = window[0];

  if (trendDirection === "bullish") {
    const aligned = bullishCount >= 2 && last.close > first.close && expanding;
    return {
      alignedWithTrend: aligned,
      direction: aligned ? "bullish" : "unknown",
      strength: aligned ? Math.min(1, 0.5 + bullishCount * 0.15) : 0.2,
      notes: aligned
        ? ["M1 momentum resumes bullish."]
        : ["Waiting for bullish displacement on M1."],
    };
  }

  const aligned = bearishCount >= 2 && last.close < first.close && expanding;
  return {
    alignedWithTrend: aligned,
    direction: aligned ? "bearish" : "unknown",
    strength: aligned ? Math.min(1, 0.5 + bearishCount * 0.15) : 0.2,
    notes: aligned
      ? ["M1 momentum resumes bearish."]
      : ["Waiting for bearish displacement on M1."],
  };
}
