/**
 * Build deterministic DecisionAuditLog from a TradingDecisionResult shell.
 */

import type {
  DecisionAuditLog,
  SupportResistanceAnalysis,
  TradeDecision,
  TradingDecisionResult,
} from "./types";

export function buildDecisionAudit(input: {
  symbol: TradingDecisionResult["symbol"];
  decision: TradeDecision;
  confidence: number;
  trend: TradingDecisionResult["trend"];
  supportResistance: SupportResistanceAnalysis;
  pullback: TradingDecisionResult["pullback"];
  rejection: TradingDecisionResult["rejection"];
  momentum: TradingDecisionResult["momentum"];
  entry: TradingDecisionResult["entry"];
  exit: TradingDecisionResult["exit"];
  validation: TradingDecisionResult["validation"];
  reasons: string[];
  timestamp?: number;
}): DecisionAuditLog {
  return {
    timestamp: input.timestamp ?? Date.now(),
    symbol: input.symbol,
    m5Trend: input.trend.direction,
    m5TrendStrength: input.trend.strength,
    support: input.supportResistance.nearestSupport,
    resistance: input.supportResistance.nearestResistance,
    m1Pullback: input.pullback.detected,
    pullbackDepth: input.pullback.depth,
    rejection: input.rejection.detected,
    rejectionSide: input.rejection.side,
    momentum: input.momentum.alignedWithTrend,
    confidence: input.confidence,
    confidenceFeatures: input.validation.breakdown.features,
    decision: input.decision,
    entryDecision: input.entry.decision,
    exitDecision: input.exit.decision,
    rulesPassed: input.validation.passedRules,
    rulesFailed: input.validation.failedRules,
    reasons: input.reasons,
  };
}
