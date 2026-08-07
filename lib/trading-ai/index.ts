/**
 * Trading AI Brain — public API (phase 1 architecture).
 *
 * Usage:
 *   import { decideTradingAction, DEFAULT_TRADING_AI_CONFIG } from "@/lib/trading-ai";
 *
 * No MT5, no live orders. `executable` is always false.
 */

export { TRADING_AI_VERSION, HARD_RULES, DEFAULT_TRADING_AI_CONFIG, mergeTradingAiConfig } from "./config";
export type { TradingAiConfig } from "./config";

export type {
  TradeDecision,
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
  ValidationResult,
  TradingDecisionResult,
  JournalEntry,
  BacktestTrade,
  BacktestResult,
} from "./types";

export { decideTradingAction, type DecideOptions } from "./decide";

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
