/**
 * Compact trade signal for MT5 EA polling.
 * Decision always comes from decideTradingAction — never Claude.
 */

import { isEaSignalExecutionEnabled, TRADING_AI_VERSION } from "./config";
import type { AccountMode } from "./execution-gate";
import type { DecisionAuditLog, TradeDecision, TradingDecisionResult } from "./types";

export type EaTradeSignal = {
  ok: true;
  signalId: string;
  version: string;
  symbol: string;
  decision: TradeDecision;
  confidence: number;
  /**
   * Izin eksekusi dari server. true HANYA kalau:
   * BUY/SELL/CLOSE + confidence >= minimum + akun DEMO + env aktif.
   * EA tetap wajib cek InpRequireDemo + InpAllowTrading sendiri.
   */
  serverExecutable: boolean;
  /** Mode akun yang dipakai server saat evaluasi (dari EA). */
  accountMode: AccountMode;
  /** Ambang confidence yang dipakai gate. */
  minConfidence: number;
  /** Alasan kenapa serverExecutable=false. Kosong kalau boleh eksekusi. */
  executionBlockedBy: string[];
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
    // Sumber tunggal: execution gate di decideTradingAction. Jangan hitung ulang di sini.
    serverExecutable: result.executable,
    accountMode: result.execution.accountMode,
    minConfidence: result.execution.minConfidence,
    executionBlockedBy: result.execution.blockedBy,
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
