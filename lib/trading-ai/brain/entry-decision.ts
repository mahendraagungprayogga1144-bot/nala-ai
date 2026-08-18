/**
 * Entry Decision Engine — M5 bias + M1 pullback/rejection/momentum.
 * Bullish M5 → BUY only; bearish M5 → SELL only;
 * sideways → range-box scalp: BUY/SELL ikut rejection + momentum M1 di S/R.
 * unknown → WAIT.
 * TP dynamic by M5 + momentum strength (scalping bands).
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
    return WAIT(
      trend.direction === "sideways"
        ? "Range box: waiting for M1 pullback into S/R."
        : "Waiting for M1 pullback into zone.",
    );
  }

  if (!rejection.detected) {
    return WAIT("Pullback seen, waiting for rejection at S/R.");
  }

  if (!momentum.alignedWithTrend) {
    return WAIT(
      trend.direction === "sideways"
        ? "Rejection seen — waiting for M1 momentum in box."
        : "Rejection seen, waiting for momentum back with M5 bias.",
    );
  }

  // --- Range / kotak S/R (M5 sideways): arah dari rejection + momentum M1 ---
  if (trend.direction === "sideways") {
    if (rejection.side === "bullish" && momentum.direction === "bullish") {
      return buildLong({
        marketPrice,
        rejection,
        pullback,
        supportResistance,
        trend,
        momentum,
        config,
        reason: "M5 sideways range-box — M1 bullish rejection/momentum at support.",
      });
    }
    if (rejection.side === "bearish" && momentum.direction === "bearish") {
      return buildShort({
        marketPrice,
        rejection,
        pullback,
        supportResistance,
        trend,
        momentum,
        config,
        reason: "M5 sideways range-box — M1 bearish rejection/momentum at resistance.",
      });
    }
    return WAIT("Range box: rejection/momentum side mismatch — WAIT.");
  }

  if (trend.direction === "bullish") {
    if (rejection.side === "bearish") {
      return WAIT("M5 bullish — ignore bearish rejection (BUY only).");
    }
    return buildLong({
      marketPrice,
      rejection,
      pullback,
      supportResistance,
      trend,
      momentum,
      config,
      reason: "M5 bullish + M1 pullback/rejection/momentum aligned.",
    });
  }

  if (trend.direction === "bearish") {
    if (rejection.side === "bullish") {
      return WAIT("M5 bearish — ignore bullish rejection (SELL only).");
    }
    return buildShort({
      marketPrice,
      rejection,
      pullback,
      supportResistance,
      trend,
      momentum,
      config,
      reason: "M5 bearish + M1 pullback/rejection/momentum aligned.",
    });
  }

  return WAIT("Setup incomplete.");
}
