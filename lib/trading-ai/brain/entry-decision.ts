/**
 * Entry Decision Engine — baca M1 cepat:
 * - Pullback dangkal ikut tekanan
 * - Exhaustion: SELL di pucuk / BUY di dasar
 * M5 unknown → WAIT. Arah entry mengikuti sisi setup M1 yang matang.
 */

import type { TradingAiConfig } from "../config";
import type {
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SupportResistanceAnalysis,
  TrendAnalysis,
} from "../types";
import { dynamicTakeProfitDistance } from "./dynamic-tp";

function buildLong(input: {
  marketPrice: number;
  rejection: RejectionAnalysis;
  pullback: PullbackAnalysis;
  supportResistance: SupportResistanceAnalysis;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  config: TradingAiConfig;
  reason: string;
}): EntrySignal {
  const { marketPrice, rejection, pullback, supportResistance, trend, momentum, config, reason } =
    input;
  const rawSl = rejection.atPrice ?? pullback.nearLevel ?? supportResistance.nearestSupport;
  const sl =
    rawSl != null ? Math.min(rawSl, marketPrice - Math.max(marketPrice * 0.0003, 0.05)) : null;
  const risk = sl != null ? Math.max(marketPrice - sl, marketPrice * 0.0005) : marketPrice * 0.0005;
  const tpDist = dynamicTakeProfitDistance({
    marketPrice,
    riskDistance: risk,
    m5Strength: trend.strength,
    momentumStrength: momentum.strength,
    baseRr: config.brain.takeProfitRr,
  });
  return {
    decision: "BUY",
    reason,
    suggestedStopLoss: sl,
    suggestedTakeProfit: marketPrice + tpDist,
    suggestedLot: config.risk.defaultLot,
  };
}

function buildShort(input: {
  marketPrice: number;
  rejection: RejectionAnalysis;
  pullback: PullbackAnalysis;
  supportResistance: SupportResistanceAnalysis;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  config: TradingAiConfig;
  reason: string;
}): EntrySignal {
  const { marketPrice, rejection, pullback, supportResistance, trend, momentum, config, reason } =
    input;
  const rawSl = rejection.atPrice ?? pullback.nearLevel ?? supportResistance.nearestResistance;
  const sl =
    rawSl != null ? Math.max(rawSl, marketPrice + Math.max(marketPrice * 0.0003, 0.05)) : null;
  const risk = sl != null ? Math.max(sl - marketPrice, marketPrice * 0.0005) : marketPrice * 0.0005;
  const tpDist = dynamicTakeProfitDistance({
    marketPrice,
    riskDistance: risk,
    m5Strength: trend.strength,
    momentumStrength: momentum.strength,
    baseRr: config.brain.takeProfitRr,
  });
  return {
    decision: "SELL",
    reason,
    suggestedStopLoss: sl,
    suggestedTakeProfit: marketPrice - tpDist,
    suggestedLot: config.risk.defaultLot,
  };
}

const WAIT = (reason: string): EntrySignal => ({
  decision: "WAIT",
  reason,
  suggestedStopLoss: null,
  suggestedTakeProfit: null,
  suggestedLot: null,
});

function isExhaustion(pullback: PullbackAnalysis, momentum: MomentumAnalysis): boolean {
  const notes = [...(pullback.notes ?? []), ...(momentum.notes ?? [])].join(" ").toLowerCase();
  return notes.includes("exhaustion");
}

/**
 * Filter kotak: cegah BUY di pucuk / SELL di dasar untuk scalp biasa.
 * Exhaustion (sengaja di ekstrem) tidak diblok.
 */
function rangeEdgeAllows(
  side: "BUY" | "SELL",
  marketPrice: number,
  support: number | null,
  resistance: number | null,
  exhaustion: boolean,
): { ok: boolean; reason: string } {
  if (exhaustion) return { ok: true, reason: "" };
  if (support == null || resistance == null || !(resistance > support)) {
    return { ok: true, reason: "" };
  }
  const mid = (support + resistance) / 2;
  const box = resistance - support;
  if (side === "BUY") {
    if (marketPrice >= mid + box * 0.05) {
      return {
        ok: false,
        reason: `Harga ${marketPrice.toFixed(2)} dekat resistance — jangan BUY di pucuk.`,
      };
    }
    return { ok: true, reason: "" };
  }
  if (marketPrice <= mid - box * 0.05) {
    return {
      ok: false,
      reason: `Harga ${marketPrice.toFixed(2)} dekat support — jangan SELL di dasar.`,
    };
  }
  return { ok: true, reason: "" };
}

export function decideEntry(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  supportResistance: SupportResistanceAnalysis;
  marketPrice: number;
  config: TradingAiConfig;
}): EntrySignal {
  const { trend, pullback, rejection, momentum, supportResistance, marketPrice, config } = input;

  if (trend.direction === "unknown") {
    return WAIT("M5 bias unknown — no entry.");
  }

  if (!pullback.detected) {
    return WAIT("Waiting for M1 pullback or extreme exhaustion.");
  }

  if (!rejection.detected) {
    return WAIT("Setup incomplete — need entry candle.");
  }

  if (!momentum.alignedWithTrend) {
    return WAIT("Need M1 pressure/exhaustion confirmation.");
  }

  const exhaustion = isExhaustion(pullback, momentum);
  const common = {
    marketPrice,
    rejection,
    pullback,
    supportResistance,
    trend,
    momentum,
    config,
  };

  if (rejection.side === "bullish" && momentum.direction === "bullish") {
    const edge = rangeEdgeAllows(
      "BUY",
      marketPrice,
      supportResistance.nearestSupport,
      supportResistance.nearestResistance,
      exhaustion,
    );
    if (!edge.ok) return WAIT(edge.reason);
    return buildLong({
      ...common,
      reason: exhaustion
        ? `BUY dasar exhaustion (M5 ${trend.direction}).`
        : `BUY pullback dangkal (M5 ${trend.direction}).`,
    });
  }

  if (rejection.side === "bearish" && momentum.direction === "bearish") {
    const edge = rangeEdgeAllows(
      "SELL",
      marketPrice,
      supportResistance.nearestSupport,
      supportResistance.nearestResistance,
      exhaustion,
    );
    if (!edge.ok) return WAIT(edge.reason);
    return buildShort({
      ...common,
      reason: exhaustion
        ? `SELL pucuk exhaustion (M5 ${trend.direction}).`
        : `SELL pullback dangkal (M5 ${trend.direction}).`,
    });
  }

  return WAIT("M1 setup side mismatch — WAIT.");
}
