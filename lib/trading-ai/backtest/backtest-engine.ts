/**
 * Backtest Engine — replay M1 against M5 using decideTradingAction.
 * Brain rules unchanged. Max 1 position. No broker.
 */

import { mergeTradingAiConfig, type TradingAiConfig } from "../config";
import { decideTradingAction } from "../decide";
import type {
  BacktestResult,
  BacktestTrade,
  Candle,
  OpenPosition,
} from "../types";

export type BacktestInput = {
  symbol: TradingAiConfig["symbol"];
  m5Candles: Candle[];
  m1Candles: Candle[];
  config?: Parameters<typeof mergeTradingAiConfig>[0];
  /** Cap bars for speed (default 4000 M1 steps). */
  maxSteps?: number;
};

const M5_WINDOW = 120;
const M1_WINDOW = 120;

function upperBoundTime(candles: Candle[], t: number) {
  // last index with time <= t
  let lo = 0;
  let hi = candles.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function pnlFor(side: "BUY" | "SELL", entry: number, exit: number, lot: number) {
  // Approximate XAUUSD: $1 per 0.01 lot per $1 move (simplified).
  const mult = lot * 100;
  return side === "BUY" ? (exit - entry) * mult : (entry - exit) * mult;
}

function hitStopOrTp(
  side: "BUY" | "SELL",
  bar: Candle,
  sl: number | null,
  tp: number | null,
): { price: number; reason: string } | null {
  if (side === "BUY") {
    if (sl != null && bar.low <= sl) return { price: sl, reason: "SL hit" };
    if (tp != null && bar.high >= tp) return { price: tp, reason: "TP hit" };
  } else {
    if (sl != null && bar.high >= sl) return { price: sl, reason: "SL hit" };
    if (tp != null && bar.low <= tp) return { price: tp, reason: "TP hit" };
  }
  return null;
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const config = mergeTradingAiConfig(input.config);
  const m5 = [...input.m5Candles].sort((a, b) => a.time - b.time);
  const m1 = [...input.m1Candles].sort((a, b) => a.time - b.time);
  const notes: string[] = [];

  if (m5.length < config.brain.minM5Candles) {
    return emptyResult(input.symbol, m5, m1, [
      `M5 kurang: butuh ≥ ${config.brain.minM5Candles}, ada ${m5.length}.`,
    ]);
  }
  if (m1.length < config.brain.minM1Candles) {
    return emptyResult(input.symbol, m5, m1, [
      `M1 kurang: butuh ≥ ${config.brain.minM1Candles}, ada ${m1.length}.`,
    ]);
  }

  const startIdx = Math.max(config.brain.minM1Candles, 10);
  const maxSteps = input.maxSteps ?? 4000;
  const endIdx = Math.min(m1.length - 1, startIdx + maxSteps - 1);

  let position: OpenPosition | null = null;
  let openTrade: BacktestTrade | null = null;
  const trades: BacktestTrade[] = [];
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let signalsBuy = 0;
  let signalsSell = 0;

  const closePos = (exitTime: number, exitPrice: number, reason: string) => {
    if (!position || !openTrade) return;
    const pnl = pnlFor(position.side, position.openPrice, exitPrice, position.lot);
    openTrade.exitTime = exitTime;
    openTrade.exitPrice = exitPrice;
    openTrade.pnl = pnl;
    openTrade.decisionReasons = [...openTrade.decisionReasons, reason];
    trades.push(openTrade);
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    position = null;
    openTrade = null;
  };

  for (let i = startIdx; i <= endIdx; i++) {
    const bar = m1[i];
    const m5End = upperBoundTime(m5, bar.time);
    if (m5End < config.brain.minM5Candles - 1) continue;

    const m5Slice = m5.slice(Math.max(0, m5End - M5_WINDOW + 1), m5End + 1);
    const m1Slice = m1.slice(Math.max(0, i - M1_WINDOW + 1), i + 1);

    // Manage open risk on this bar first
    if (position) {
      const hit = hitStopOrTp(
        position.side,
        bar,
        position.stopLoss,
        position.takeProfit,
      );
      if (hit) {
        closePos(bar.time, hit.price, hit.reason);
      }
    }

    const positions = position ? [position] : [];
    const spreadPoints = 20;
    const decision = decideTradingAction(
      {
        symbol: input.symbol,
        m5Candles: m5Slice,
        m1Candles: m1Slice,
        market: {
          symbol: input.symbol,
          bid: bar.close,
          ask: bar.close + 0.2,
          spread: spreadPoints,
          at: bar.time * 1000,
        },
        openPositions: positions,
      },
      { config },
    );

    if (decision.decision === "CLOSE" && position) {
      closePos(bar.time, bar.close, decision.reasons[0] || "CLOSE signal");
      continue;
    }

    if (!position && (decision.decision === "BUY" || decision.decision === "SELL")) {
      if (decision.decision === "BUY") signalsBuy++;
      else signalsSell++;

      const side = decision.decision;
      const entry = side === "BUY" ? bar.close + 0.2 : bar.close;
      const lot = decision.entry.suggestedLot ?? config.risk.defaultLot;
      const id = `bt_${bar.time}_${side}`;
      position = {
        id,
        symbol: input.symbol,
        side,
        lot,
        openPrice: entry,
        stopLoss: decision.entry.suggestedStopLoss,
        takeProfit: decision.entry.suggestedTakeProfit,
        openedAt: bar.time * 1000,
        floatingPnl: 0,
      };
      openTrade = {
        side,
        entryTime: bar.time,
        exitTime: null,
        entryPrice: entry,
        exitPrice: null,
        lot,
        pnl: null,
        decisionReasons: decision.reasons.slice(0, 3),
      };
    }
  }

  // Force flat at end
  if (position && openTrade) {
    const last = m1[endIdx];
    closePos(last.time, last.close, "End of backtest — force close");
  }

  const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const losses = trades.filter((t) => (t.pnl ?? 0) < 0).length;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  notes.push(`Steps M1: ${endIdx - startIdx + 1} (cap ${maxSteps}).`);
  notes.push(`Signals BUY=${signalsBuy} SELL=${signalsSell}. Trades closed=${trades.length}.`);
  notes.push("Otak rule tidak diubah — backtest hanya replay decideTradingAction.");
  notes.push("PnL approx (bukan kontrak broker). MT5 belum tersambung.");

  return {
    symbol: input.symbol,
    from: m1[startIdx]?.time ?? 0,
    to: m1[endIdx]?.time ?? 0,
    trades,
    wins,
    losses,
    totalPnl,
    maxDrawdown,
    notes,
  };
}

function emptyResult(
  symbol: TradingAiConfig["symbol"],
  m5: Candle[],
  m1: Candle[],
  notes: string[],
): BacktestResult {
  const times = [...m5, ...m1].map((c) => c.time);
  return {
    symbol,
    from: times.length ? Math.min(...times) : 0,
    to: times.length ? Math.max(...times) : 0,
    trades: [],
    wins: 0,
    losses: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    notes,
  };
}
