/**
 * Compact trade signal for MT5 EA polling.
 * Decision always comes from decideTradingAction — never Claude.
 */

import { isEaSignalExecutionEnabled, TRADING_AI_VERSION } from "./config";
import { EXECUTION_MODE, type ExecutionMode } from "./execution-control";
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
  /** Selalu DEMO_AUTOTRADE — order sungguhan ke akun demo, bukan paper. */
  executionMode: ExecutionMode;
  /** Tombol dashboard [DEMO AUTOTRADE ON/OFF]. */
  autotrade: boolean;
  /** Tombol dashboard [EMERGENCY STOP]. */
  emergencyStop: boolean;
  /** Sisa cooldown entry dalam detik. 0 = bebas. */
  cooldownRemaining: number;
  /** M5 menentukan arah — dipakai EA untuk baris log M5_BIAS. */
  m5Bias: string;
  /** M1 menentukan timing — dipakai EA untuk baris log M1_DIRECTION. */
  m1Direction: string;
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

export type EaSignalRuntime = {
  /** Epoch detik candle M1 terakhir. Bikin signalId stabil dalam satu bar. */
  barTime?: number | null;
  autotrade?: boolean;
  emergencyStop?: boolean;
  cooldownRemaining?: number;
  /** Blocker runtime (autotrade OFF / emergency stop / cooldown). */
  controlBlockedBy?: string[];
};

/**
 * signalId sengaja deterministik terhadap (bar M1, decision, confidence).
 * Polling berulang dalam bar yang sama menghasilkan id yang sama, sehingga
 * EA bisa menjamin "satu signal = maksimal satu order attempt".
 */
export function buildSignalId(
  result: TradingDecisionResult,
  barTime?: number | null,
): string {
  const bucket =
    barTime && Number.isFinite(barTime)
      ? Math.floor(barTime)
      : Math.floor(result.generatedAt / 60_000) * 60;
  return `sig_${result.symbol}_${bucket}_${result.decision}_${result.confidence}`;
}

export function toEaTradeSignal(
  result: TradingDecisionResult,
  runtime: EaSignalRuntime = {},
): EaTradeSignal {
  const eaMayExecute = isEaSignalExecutionEnabled();
  const signalId = buildSignalId(result, runtime.barTime);
  const controlBlockedBy = runtime.controlBlockedBy ?? [];
  // Lapisan runtime hanya boleh mempersempit izin dari execution gate.
  const serverExecutable = result.executable && controlBlockedBy.length === 0;
  return {
    ok: true,
    signalId,
    version: TRADING_AI_VERSION,
    symbol: result.symbol,
    decision: result.decision,
    confidence: result.confidence,
    // Execution gate (demo-only, confidence) + control runtime (tombol, cooldown).
    serverExecutable,
    accountMode: result.execution.accountMode,
    minConfidence: result.execution.minConfidence,
    executionBlockedBy: [...result.execution.blockedBy, ...controlBlockedBy],
    eaMayExecute,
    executionMode: EXECUTION_MODE,
    autotrade: runtime.autotrade ?? false,
    emergencyStop: runtime.emergencyStop ?? false,
    cooldownRemaining: runtime.cooldownRemaining ?? 0,
    m5Bias: result.trend.direction,
    m1Direction: result.momentum.direction,
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
