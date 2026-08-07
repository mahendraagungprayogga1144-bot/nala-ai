/**
 * Entry Decision Engine — combines M5 bias + M1 pullback/rejection/momentum.
 * Rule: bullish M5 → BUY only; bearish M5 → SELL only; else WAIT.
 * Phase 1: always WAIT until detectors are real.
 */

import type { TradingAiConfig } from "../config";
import type {
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  TrendAnalysis,
} from "../types";

export function decideEntry(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  config: TradingAiConfig;
}): EntrySignal {
  const { trend, pullback, rejection, momentum, config } = input;

  if (trend.direction === "unknown" || trend.direction === "ranging") {
    return {
      decision: "WAIT",
      reason: "M5 bias not clear — no entry.",
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

  // Hard directional gates
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
    return {
      decision: "BUY",
      reason: "M5 bullish + M1 pullback/rejection/momentum aligned.",
      suggestedStopLoss: null, // phase-2: below rejection low / support
      suggestedTakeProfit: null,
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
    return {
      decision: "SELL",
      reason: "M5 bearish + M1 pullback/rejection/momentum aligned.",
      suggestedStopLoss: null,
      suggestedTakeProfit: null,
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
