/**
 * Momentum Detector — standalone M1 pressure (not just last candle color).
 * Used live by sequenced setup + decideEntry chain.
 */

import type { Candle, MomentumAnalysis, TrendDirection } from "../types";
import { atrApprox, bodySize, isBearishCandle, isBullishCandle, lastClosedIndex } from "./price-action";

export function detectMomentum(
  m1Candles: Candle[],
  trendDirection: TrendDirection,
): MomentumAnalysis {
  if (trendDirection === "unknown") {
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
  const window = m1Candles.slice(Math.max(0, closed - 3), closed + 1);
  if (window.length < 3) {
    return {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Momentum window too short."],
    };
  }

  const atr = atrApprox(m1Candles) || window[window.length - 1].close * 0.001;
  const bullishCount = window.filter(isBullishCandle).length;
  const bearishCount = window.filter(isBearishCandle).length;
  const avgBody = window.reduce((s, c) => s + bodySize(c), 0) / window.length;
  const last = window[window.length - 1];
  const first = window[0];
  const lastBody = bodySize(last);
  const expanding = lastBody >= avgBody * 0.75;
  const net = last.close - first.close;
  const speedOk = Math.abs(net) >= atr * 0.12;

  const evalBull = () => {
    const aligned =
      bullishCount >= 2 &&
      last.close > first.close &&
      (expanding || speedOk) &&
      isBullishCandle(last);
    return {
      alignedWithTrend: aligned,
      direction: (aligned ? "bullish" : "unknown") as TrendDirection,
      strength: aligned ? Math.min(1, 0.45 + bullishCount * 0.12 + (expanding ? 0.15 : 0)) : 0.15,
      notes: aligned
        ? ["M1 momentum resumes bullish (body + pressure)."]
        : ["Waiting for bullish M1 momentum (pressure not back yet)."],
    };
  };

  const evalBear = () => {
    const aligned =
      bearishCount >= 2 &&
      last.close < first.close &&
      (expanding || speedOk) &&
      isBearishCandle(last);
    return {
      alignedWithTrend: aligned,
      direction: (aligned ? "bearish" : "unknown") as TrendDirection,
      strength: aligned ? Math.min(1, 0.45 + bearishCount * 0.12 + (expanding ? 0.15 : 0)) : 0.15,
      notes: aligned
        ? ["M1 momentum resumes bearish (body + pressure)."]
        : ["Waiting for bearish M1 momentum (pressure not back yet)."],
    };
  };

  if (trendDirection === "bullish") return evalBull();
  if (trendDirection === "bearish") return evalBear();

  // RANGE: report the stronger side pressure
  return bullishCount >= bearishCount ? evalBull() : evalBear();
}
