/**
 * Entry Decision Engine — M5 bias + M1 pullback/rejection/momentum.
 * Bullish M5 → BUY only; bearish M5 → SELL only; sideways/unknown → WAIT.
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

  if (trend.direction === "unknown" || trend.direction === "sideways") {
    return {
      decision: "WAIT",
      reason: "M5 bias not clear (sideways/unknown) — no entry.",
      suggestedStopLoss: null,
      suggestedTakeProfit: null,
      suggestedLot: null,
    };
  }

  if (!pullback.detected) {
    return {
      decision: "WAIT",
      reason: "Waiting for M1 pullback into zone.",
      suggestedStopLoss: null,
      suggestedTakeProfit: null,
      suggestedLot: null,
    };
  }

  if (!rejection.detected) {
    return {
      decision: "WAIT",
      reason: "Pullback seen, waiting for rejection at S/R.",
      suggestedStopLoss: null,
      suggestedTakeProfit: null,
      suggestedLot: null,
    };
  }

  if (!momentum.alignedWithTrend) {
    return {
      decision: "WAIT",
      reason: "Rejection seen, waiting for momentum back with M5 bias.",
      suggestedStopLoss: null,
      suggestedTakeProfit: null,
      suggestedLot: null,
    };
  }

  if (trend.direction === "bullish") {
    if (rejection.side === "bearish") {
      return {
        decision: "WAIT",
        reason: "M5 bullish — ignore bearish rejection (BUY only).",
        suggestedStopLoss: null,
        suggestedTakeProfit: null,
        suggestedLot: null,
      };
    }
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
    const tp = marketPrice + tpDist;
    return {
      decision: "BUY",
      reason: "M5 bullish + M1 pullback/rejection/momentum aligned.",
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      suggestedLot: config.risk.defaultLot,
    };
  }

  if (trend.direction === "bearish") {
    if (rejection.side === "bullish") {
      return {
        decision: "WAIT",
        reason: "M5 bearish — ignore bullish rejection (SELL only).",
        suggestedStopLoss: null,
        suggestedTakeProfit: null,
        suggestedLot: null,
      };
    }
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
    const tp = marketPrice - tpDist;
    return {
      decision: "SELL",
      reason: "M5 bearish + M1 pullback/rejection/momentum aligned.",
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      suggestedLot: config.risk.defaultLot,
    };
  }

  return {
    decision: "WAIT",
    reason: "Setup incomplete.",
    suggestedStopLoss: null,
    suggestedTakeProfit: null,
    suggestedLot: null,
  };
}
