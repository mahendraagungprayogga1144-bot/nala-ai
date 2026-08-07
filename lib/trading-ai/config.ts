/**
 * Trading AI Brain — rule configuration.
 * Tunable defaults for XAUUSD M5 trend / M1 entry style.
 * Phase 1: no broker coupling.
 */

import type { SymbolCode, Timeframe } from "./types";

export const TRADING_AI_VERSION = "0.1.0-phase1";

/** Hard product rules — never override from UI without deliberate change. */
export const HARD_RULES = {
  maxOpenPositions: 1,
  allowAveraging: false,
  allowMartingale: false,
  allowGrid: false,
  allowHedge: false,
  /** Phase 1 never sends orders. */
  liveTradingEnabled: false,
  mt5Enabled: false,
} as const;

export type TradingAiConfig = {
  symbol: SymbolCode;
  trendTimeframe: Timeframe;
  entryTimeframe: Timeframe;
  /** Prefer price action over classic oscillators. */
  primaryApproach: "price_action";
  useIndicatorsAsPrimary: false;
  risk: {
    maxOpenPositions: number;
    defaultLot: number;
    maxLot: number;
    /** Max floating loss as fraction of balance (placeholder until account feed exists). */
    maxFloatingRiskPct: number;
    /** Reject entry if spread (points) above this. */
    maxSpreadPoints: number;
  };
  brain: {
    /** Min M5 candles required before analyzing trend. */
    minM5Candles: number;
    minM1Candles: number;
    /** Pullback depth band that still counts as valid (fraction of last swing). */
    pullbackMinDepth: number;
    pullbackMaxDepth: number;
    /** Min confidence (0–100) to allow BUY/SELL instead of WAIT. */
    minConfidenceToEnter: number;
  };
};

export const DEFAULT_TRADING_AI_CONFIG: TradingAiConfig = {
  symbol: "XAUUSD",
  trendTimeframe: "M5",
  entryTimeframe: "M1",
  primaryApproach: "price_action",
  useIndicatorsAsPrimary: false,
  risk: {
    maxOpenPositions: HARD_RULES.maxOpenPositions,
    defaultLot: 0.01,
    maxLot: 0.1,
    maxFloatingRiskPct: 2,
    maxSpreadPoints: 35,
  },
  brain: {
    minM5Candles: 50,
    minM1Candles: 30,
    pullbackMinDepth: 0.2,
    pullbackMaxDepth: 0.7,
    minConfidenceToEnter: 65,
  },
};

export function mergeTradingAiConfig(
  partial?: Partial<TradingAiConfig> & {
    risk?: Partial<TradingAiConfig["risk"]>;
    brain?: Partial<TradingAiConfig["brain"]>;
  },
): TradingAiConfig {
  if (!partial) return { ...DEFAULT_TRADING_AI_CONFIG, risk: { ...DEFAULT_TRADING_AI_CONFIG.risk }, brain: { ...DEFAULT_TRADING_AI_CONFIG.brain } };
  return {
    ...DEFAULT_TRADING_AI_CONFIG,
    ...partial,
    risk: { ...DEFAULT_TRADING_AI_CONFIG.risk, ...partial.risk },
    brain: { ...DEFAULT_TRADING_AI_CONFIG.brain, ...partial.brain },
    // Hard overrides — cannot be weakened by partial config.
    useIndicatorsAsPrimary: false,
    primaryApproach: "price_action",
  };
}
