/**
 * Trading AI Brain — public API.
 *
 * Server never places MT5 orders. EA polls /api/trading-ai/signal.
 */

export {
  TRADING_AI_VERSION,
  HARD_RULES,
  EXECUTION_MIN_CONFIDENCE,
  DEFAULT_TRADING_AI_CONFIG,
  mergeTradingAiConfig,
  isEaSignalExecutionEnabled,
} from "./config";
export type { TradingAiConfig } from "./config";

export {
  evaluateExecutionGate,
  parseAccountMode,
  blockedGate,
  type AccountMode,
  type ExecutionGate,
  type ExecutionGateInput,
} from "./execution-gate";

export type {
  TradeDecision,
  EntryDecision,
  ExitDecision,
  TrendDirection,
  MarketRegime,
  EntryQuality,
  SetupKind,
  Timeframe,
  SymbolCode,
  Candle,
  MarketSnapshot,
  OpenPosition,
  TrendAnalysis,
  SrLevel,
  SupportResistanceAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  MomentumAnalysis,
  BrainContext,
  EntrySignal,
  ExitSignal,
  RiskCheck,
  ConfidenceFeature,
  ConfidenceBreakdown,
  ValidationResult,
  TradingDecisionResult,
  ExecutionGateSummary,
  DecisionAuditLog,
  JournalEntry,
  BacktestTrade,
  BacktestResult,
} from "./types";

export {
  EXECUTION_MODE,
  DEFAULT_COOLDOWN_SECONDS,
  DEFAULT_EXECUTION_CONTROL,
  MIN_LOT,
  clampCooldownSeconds,
  clampLot,
  cooldownRemainingSeconds,
  evaluateRuntimeControl,
  parseExecutionControlRow,
  type ExecutionMode,
  type ExecutionControlState,
  type ExecutionControlRow,
  type RuntimeControlVerdict,
} from "./execution-control";

export {
  BRIDGE_HEALTHY_WINDOW_SEC,
  BRIDGE_CONNECT_TIMEOUT_SEC,
  BRIDGE_PROBE_TIMEOUT_MS,
  ageSeconds,
  combineBridgeState,
  evaluateChannelHealth,
  summarizeBridge,
  type BridgeConnectionState,
  type BridgeChannelId,
  type BridgeChannelHealth,
  type BridgeProbe,
  type BridgeHealth,
} from "./bridge-health";

export {
  collectBridgeHealth,
  type BridgeHealthResult,
  type BridgeAccountInfo,
} from "./bridge-health-query";

export {
  formatMt5Time,
  formatMt5DateTime,
  estimateBrokerNowSec,
  formatGmtOffsetLabel,
} from "./mt5-time";

export {
  collectLiveActivity,
  buildOpenHint,
  type LiveActivity,
  type LiveOrderRow,
  type LiveSignalSnapshot,
} from "./live-activity";

export {
  buildQuantStats,
  emptyQuantStats,
  activeCycleStage,
  type QuantStats,
  type CycleStageId,
} from "./quant-stats";

export {
  inferOpenPosition,
  lastJournalLabel,
  estimateGoldFloatingUsd,
  goldPoints,
  buildPipeline,
  buildWhySignal,
  journalReason,
  entryQuality,
  marketRegime,
  countFillsSince,
  durationLabel,
  mapLiveDecision,
  displayChannelState,
  directionalBiasFromM5,
  type DeskOpenPosition,
  type PipelineStep,
  type PipelineStepStatus,
  type WhyBullet,
} from "./quant-desk";

export { normalizeTradingSymbol, normalizeGoldSpreadPoints } from "./symbol";

export {
  SIGNAL_FRESHNESS_MS,
  isSignalFresh,
  signalAgeMs,
} from "./signal-freshness";

export { decideTradingAction, type DecideOptions } from "./decide";
export { buildDecisionAudit } from "./audit";
export {
  toEaTradeSignal,
  buildSignalId,
  type EaTradeSignal,
  type EaSignalRuntime,
} from "./signal";

export { parseCandlesCsv, parseCandlesFile, type ParseCandlesResult } from "./csv-candles";

export {
  generateBridgeApiKey,
  loadCandles,
  getCandleFeedStatus,
  type BridgeKeyRow,
  type CandleFeedStatus,
} from "./mt5-feed";

export { explainTradingDecision, type ExplainResult } from "./ai-explain";

export * as brain from "./brain";
export * as risk from "./risk";
export * as validator from "./validator";
export * as journal from "./journal";
export * as backtest from "./backtest";
