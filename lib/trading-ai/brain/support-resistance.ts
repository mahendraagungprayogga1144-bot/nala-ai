/**
 * Support / Resistance Analyzer — cluster swing highs/lows on M5.
 * Entry location helpers: near level vs middle of range.
 * Near-level default is TIGHT (~0.5–0.8 point) so entries stay at edges.
 */

import type { TradingAiConfig } from "../config";
import type { Candle, SrLevel, SupportResistanceAnalysis } from "../types";
import { atrApprox, clusterLevels, findSwings } from "./price-action";

export type RangeZone =
  | "near_support"
  | "near_resistance"
  | "middle"
  | "outside"
  | "incomplete";

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

/**
 * Tight near-level band for XAUUSD scalp.
 * Preferred window ~0.5–0.8 point; scales lightly with ATR when mult is low.
 * Higher levelTouchAtrMult (tests / research) may widen with ATR.
 */
export function levelTolerance(atr: number, config: TradingAiConfig, price: number): number {
  const raw = atr * config.brain.levelTouchAtrMult;
  const floor = 0.5;
  const preferredCap = 0.8;
  // Production-tight path (default mult ≤ 0.35).
  if (config.brain.levelTouchAtrMult <= 0.35) {
    return Math.max(floor, Math.min(preferredCap, raw || floor));
  }
  // Wider path for fixtures / research — still ATR-bounded.
  return Math.max(floor, Math.min(raw, Math.max(atr * 1.5, preferredCap), price * 0.002));
}

export function isNearLevel(
  price: number,
  level: number | null,
  tolerance: number,
): boolean {
  if (level == null || !(level > 0)) return false;
  return Math.abs(price - level) <= tolerance;
}

/**
 * RANGE / hybrid zone: near S / near R / middle / outside.
 * Middle = between S and R and not within touch of either edge.
 */
export function classifyRangeZone(
  price: number,
  support: number | null,
  resistance: number | null,
  tolerance: number,
): RangeZone {
  if (support == null || resistance == null || resistance <= support) return "incomplete";
  const nearS = isNearLevel(price, support, tolerance);
  const nearR = isNearLevel(price, resistance, tolerance);
  if (nearS && !nearR) return "near_support";
  if (nearR && !nearS) return "near_resistance";
  if (nearS && nearR) {
    return Math.abs(price - support) <= Math.abs(price - resistance)
      ? "near_support"
      : "near_resistance";
  }
  if (price > support && price < resistance) return "middle";
  return "outside";
}

export function entryDistanceToLevel(price: number, level: number | null): number | null {
  if (level == null || !(level > 0)) return null;
  return Math.abs(price - level);
}
