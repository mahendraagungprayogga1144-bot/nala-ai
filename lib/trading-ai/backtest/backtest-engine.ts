/**
 * Backtest Engine — scaffold only.
 * Phase 1 returns an empty structural result; no candle walk yet.
 */

import type { TradingAiConfig } from "../config";
import type { BacktestResult, Candle } from "../types";

export type BacktestInput = {
  symbol: TradingAiConfig["symbol"];
  m5Candles: Candle[];
  m1Candles: Candle[];
  config: TradingAiConfig;
};

export function runBacktest(input: BacktestInput): BacktestResult {
  const times = [...input.m5Candles, ...input.m1Candles].map((c) => c.time);
  const from = times.length ? Math.min(...times) : 0;
  const to = times.length ? Math.max(...times) : 0;

  // TODO(phase-2): walk M1 bars, call decideTradingAction, simulate 1-position fills.
  return {
    symbol: input.symbol,
    from,
    to,
    trades: [],
    wins: 0,
    losses: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    notes: [
      "Backtest Engine scaffold — no simulation yet.",
      "Wire candle feed, then replay Entry/Exit Decision Engines with max 1 position.",
    ],
  };
}
