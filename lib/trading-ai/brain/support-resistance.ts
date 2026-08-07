/**
 * Support / Resistance Analyzer — cluster swing highs/lows on M5.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, SrLevel, SupportResistanceAnalysis } from "../types";
import { atrApprox, clusterLevels, findSwings } from "./price-action";

export function analyzeSupportResistance(
  candles: Candle[],
  config: TradingAiConfig,
  currentPrice: number,
): SupportResistanceAnalysis {
  if (candles.length < config.brain.minM5Candles) {
    return {
      timeframe: config.trendTimeframe,
      levels: [],
      nearestSupport: null,
      nearestResistance: null,
    };
  }

  const atr = atrApprox(candles) || currentPrice * 0.001;
  const tol = atr * config.brain.srAtrMult;
  const swings = findSwings(candles, config.brain.swingLeft, config.brain.swingRight);

  const highClusters = clusterLevels(
    swings.filter((s) => s.kind === "high").map((s) => s.price),
    tol,
  );
  const lowClusters = clusterLevels(
    swings.filter((s) => s.kind === "low").map((s) => s.price),
    tol,
  );

  const levels: SrLevel[] = [
    ...lowClusters.map((c) => ({
      price: c.price,
      kind: "support" as const,
      touches: c.touches,
      strength: Math.min(1, 0.35 + c.touches * 0.2),
    })),
    ...highClusters.map((c) => ({
      price: c.price,
      kind: "resistance" as const,
      touches: c.touches,
      strength: Math.min(1, 0.35 + c.touches * 0.2),
    })),
  ].sort((a, b) => a.price - b.price);

  const supports = levels.filter((l) => l.kind === "support" && l.price <= currentPrice);
  const resistances = levels.filter((l) => l.kind === "resistance" && l.price >= currentPrice);

  const nearestSupport = supports.length ? supports[supports.length - 1].price : null;
  const nearestResistance = resistances.length ? resistances[0].price : null;

  return {
    timeframe: config.trendTimeframe,
    levels,
    nearestSupport,
    nearestResistance,
  };
}
