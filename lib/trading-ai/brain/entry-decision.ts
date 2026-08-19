/**
 * Entry Decision — perampok lokal:
 * BUY di dasar swing / SELL di pucuk swing. Tolak kejar tengah.
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

/** Tolak entry kalau harga sudah jauh dari level ekstrem setup. */
function chaseGuard(
  side: "BUY" | "SELL",
  marketPrice: number,
  extreme: number | null,
): { ok: boolean; reason: string } {
  if (extreme == null || !(extreme > 0)) return { ok: true, reason: "" };
  const maxChase = Math.max(marketPrice * 0.0002, 0.75);
  if (side === "BUY" && marketPrice > extreme + maxChase) {
    return {
      ok: false,
      reason: `Kejar BUY ditolak: harga ${marketPrice.toFixed(2)} sudah jauh dari dasar ${extreme.toFixed(2)}.`,
    };
  }
  if (side === "SELL" && marketPrice < extreme - maxChase) {
    return {
      ok: false,
      reason: `Kejar SELL ditolak: harga ${marketPrice.toFixed(2)} sudah jauh dari pucuk ${extreme.toFixed(2)}.`,
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

  if (!pullback.detected || !rejection.detected || !momentum.alignedWithTrend) {
    if (trend.direction === "bearish") {
      return WAIT("M5 bearish — nunggu bounce M1 lalu SELL, tapi jangan SELL kalau M1 masih naik.");
    }
    if (trend.direction === "bullish") {
      return WAIT("M5 bullish — nunggu dip M1 lalu BUY. Jangan kejar rally.");
    }
    return WAIT("Waiting for local swing setup (dasar BUY / pucuk SELL).");
  }

  if (
    trend.direction === "bullish" &&
    !(rejection.side === "bullish" && momentum.direction === "bullish")
  ) {
    return WAIT("M5 bullish — BUY bias only. M1 still bearish.");
  }
  if (
    trend.direction === "bearish" &&
    !(rejection.side === "bearish" && momentum.direction === "bearish")
  ) {
    return WAIT("M5 bearish — SELL bias only. M1 still bullish.");
  }

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
    const chase = chaseGuard("BUY", marketPrice, rejection.atPrice ?? pullback.nearLevel);
    if (!chase.ok) return WAIT(chase.reason);
    return buildLong({
      ...common,
      reason: pullback.notes[0] ?? `BUY dip / dasar (M5 ${trend.direction}).`,
    });
  }

  if (rejection.side === "bearish" && momentum.direction === "bearish") {
    const chase = chaseGuard("SELL", marketPrice, rejection.atPrice ?? pullback.nearLevel);
    if (!chase.ok) return WAIT(chase.reason);
    return buildShort({
      ...common,
      reason: pullback.notes[0] ?? `SELL bounce / pucuk (M5 ${trend.direction}).`,
    });
  }

  return WAIT("M1 setup side mismatch — WAIT.");
}
