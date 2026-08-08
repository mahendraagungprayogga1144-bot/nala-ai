/**
 * Trading AI Brain — public API.
 *
 * Server never places MT5 orders. EA polls /api/trading-ai/signal.
 */

export {
  TRADING_AI_VERSION,
  HARD_RULES,
  DEFAULT_TRADING_AI_CONFIG,
  mergeTradingAiConfig,
  isEaSignalExecutionEnabled,
} from "./config";
export type { TradingAiConfig } from "./config";

export type {
  TradeDecision,
  EntryDecision,
  ExitDecision,
  TrendDirection,
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
  DecisionAuditLog,
  JournalEntry,
  BacktestTrade,
  BacktestResult,
} from "./types";

export { decideTradingAction, type DecideOptions } from "./decide";
export { buildDecisionAudit } from "./audit";
export { toEaTradeSignal, type EaTradeSignal } from "./signal";

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
