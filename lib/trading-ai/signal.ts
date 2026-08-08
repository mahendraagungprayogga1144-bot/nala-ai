/**
 * Compact trade signal for MT5 EA polling.
 * Decision always comes from decideTradingAction — never Claude.
 */

import { isEaSignalExecutionEnabled, TRADING_AI_VERSION } from "./config";
import type { DecisionAuditLog, TradeDecision, TradingDecisionResult } from "./types";

export type EaTradeSignal = {
  ok: true;
  signalId: string;
  version: string;
  symbol: string;
  decision: TradeDecision;
  confidence: number;
  /** Always false on server — EA decides whether to OrderSend. */
  serverExecutable: false;
  /**
   * True only when env TRADING_AI_EA_SIGNALS=1.
   * EA must still enforce demo-only + InpAllowTrading.
   */
  eaMayExecute: boolean;
  lot: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  reasons: string[];
  trend: string;
  support: number | null;
  resistance: number | null;
  pullback: boolean;
  rejection: boolean;
  momentum: boolean;
  rulesPassed: string[];
  rulesFailed: string[];
  audit: Pick<
    DecisionAuditLog,
    | "timestamp"
    | "m5Trend"
    | "support"
    | "resistance"
    | "m1Pullback"
    | "pullbackDepth"
    | "rejection"
    | "rejectionSide"
    | "momentum"
    | "confidence"
    | "decision"
    | "rulesPassed"
    | "rulesFailed"
  >;
  generatedAt: number;
};

export function toEaTradeSignal(result: TradingDecisionResult): EaTradeSignal {
  const eaMayExecute = isEaSignalExecutionEnabled();
  const signalId = `sig_${result.generatedAt}_${result.decision}_${result.confidence}`;
  return {
    ok: true,
    signalId,
    version: TRADING_AI_VERSION,
    symbol: result.symbol,
    decision: result.decision,
    confidence: result.confidence,
    serverExecutable: false,
    eaMayExecute,
    lot: result.entry.suggestedLot,
    stopLoss: result.entry.suggestedStopLoss,
    takeProfit: result.entry.suggestedTakeProfit,
    reasons: result.reasons.slice(0, 8),
    trend: result.trend.direction,
    support: result.supportResistance.nearestSupport,
    resistance: result.supportResistance.nearestResistance,
    pullback: result.pullback.detected,
    rejection: result.rejection.detected,
    momentum: result.momentum.alignedWithTrend,
    rulesPassed: result.validation.passedRules,
    rulesFailed: result.validation.failedRules,
    audit: {
      timestamp: result.audit.timestamp,
      m5Trend: result.audit.m5Trend,
      support: result.audit.support,
      resistance: result.audit.resistance,
      m1Pullback: result.audit.m1Pullback,
      pullbackDepth: result.audit.pullbackDepth,
      rejection: result.audit.rejection,
      rejectionSide: result.audit.rejectionSide,
      momentum: result.audit.momentum,
      confidence: result.audit.confidence,
      decision: result.audit.decision,
      rulesPassed: result.audit.rulesPassed,
      rulesFailed: result.audit.rulesFailed,
    },
    generatedAt: result.generatedAt,
  };
}
