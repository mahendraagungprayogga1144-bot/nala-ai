/**
 * Sequenced M1 — perampok lokal (yang kita omongin):
 * BUY di dasar swing lokal (stall hijau dekat low),
 * SELL di pucuk swing lokal (stall merah dekat high).
 * Lebih sering dari "dump/spike raksasa", tetap tolak kejar tengah.
 */

import type { TradingAiConfig } from "../config";
import type {
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SupportResistanceAnalysis,
  TrendDirection,
} from "../types";
import {
  atrApprox,
  bodySize,
  isBearishCandle,
  isBullishCandle,
  lastClosedIndex,
  rangeMid,
  upperWick,
  lowerWick,
} from "./price-action";

export type SequencedSetup = {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
};

const LOOKBACK = 80;
/** Window swing lokal — cukup untuk chop M1, tidak nunggu dump besar. */
const SWING_BARS = 8;
const EXTREME_CLOSE_ATR = 0.75;
const MIN_SPAN_ATR = 0.55;

export function detectSequencedSetup(
  m1Candles: CandleLike[],
  trendDirection: TrendDirection,
  config: TradingAiConfig,
  _sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  void _sr;
  if (trendDirection === "unknown") {
    return emptySetup("No directional bias — skip M1 hunt.");
  }
  if (m1Candles.length < config.brain.minM1Candles) {
    return emptySetup(`Need at least ${config.brain.minM1Candles} M1 candles.`);
  }

  const closed = lastClosedIndex(m1Candles);
  const from = Math.max(0, closed - LOOKBACK + 1);

  if (trendDirection === "bullish") {
    return localBottomBuy(m1Candles, from, closed);
  }
  if (trendDirection === "bearish") {
    return localTopSell(m1Candles, from, closed);
  }
  // sideways: range-scalp — BUY dasar / SELL pucuk.
  return pickBest(
    localTopSell(m1Candles, from, closed),
    localBottomBuy(m1Candles, from, closed),
  );
}

function setupScore(s: SequencedSetup): number {
  return (
    (s.pullback.detected ? 1 : 0) +
    (s.rejection.detected ? 1 : 0) +
    (s.momentum.alignedWithTrend ? 1 : 0) +
    s.momentum.strength * 0.1
  );
}

function pickBest(...setups: SequencedSetup[]): SequencedSetup {
  let best = setups[0];
  for (let i = 1; i < setups.length; i++) {
    const a = setupScore(best);
    const b = setupScore(setups[i]);
    if (b > a) best = setups[i];
    else if (b === a && setups[i].pullback.detected && !best.pullback.detected) {
      best = setups[i];
    }
  }
  return best;
}

type CandleLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function emptySetup(note: string): SequencedSetup {
  return {
    pullback: { detected: false, depth: 0, nearLevel: null, notes: [note] },
    rejection: { detected: false, side: null, atPrice: null, notes: [note] },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: [note],
    },
  };
}

function waitingBuy(note: string, depth = 0, near: number | null = null): SequencedSetup {
  return {
    pullback: { detected: false, depth, nearLevel: near, notes: [note] },
    rejection: {
      detected: false,
      side: null,
      atPrice: null,
      notes: ["Need green stall at local low (BUY dasar)."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Waiting for local bottom."],
    },
  };
}

function waitingSell(note: string, depth = 0, near: number | null = null): SequencedSetup {
  return {
    pullback: { detected: false, depth, nearLevel: near, notes: [note] },
    rejection: {
      detected: false,
      side: null,
      atPrice: null,
      notes: ["Need red stall at local high (SELL pucuk)."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Waiting for local top."],
    },
  };
}

/**
 * SELL di pucuk lokal: naik dulu → merah reject dekat high window.
 */
function localTopSell(
  candles: CandleLike[],
  from: number,
  closed: number,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - SWING_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 4) return waitingSell("Local top: need more bars.");

  const last = candles[closed];
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const span = winHigh - winLow;
  if (span < atr * MIN_SPAN_ATR) {
    return waitingSell("Local top: swing terlalu tipis.", 0, winHigh);
  }

  const first = win[0];
  // Ada dorongan naik di window (bukan flat).
  if (!(winHigh >= first.high + atr * 0.2 || last.high >= first.close + atr * 0.25)) {
    return waitingSell("Local top: belum ada naik ke pucuk lokal.", 0, winHigh);
  }

  // Masih di zona pucuk — jangan SELL setelah sudah anjlok jauh.
  if (winHigh - last.close > atr * EXTREME_CLOSE_ATR) {
    return waitingSell("Local top: sudah jauh dari pucuk — jangan kejar.", 0, winHigh);
  }
  if (winHigh - last.high > atr * 0.35) {
    return waitingSell("Local top: high sudah lewat.", 0, winHigh);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectTop =
    isBearishCandle(last) &&
    (upperWick(last) >= barRange * 0.15 || last.close <= rangeMid(last) || bodySize(last) >= atr * 0.12);
  if (!rejectTop) {
    return waitingSell("Local top: nunggu candle merah reject di pucuk.", 0, winHigh);
  }

  const depth = Math.min(0.55, span / Math.max(atr * 2.5, span));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.high,
      notes: ["Local swing top — SELL di pucuk lokal."],
    },
    rejection: {
      detected: true,
      side: "bearish",
      atPrice: last.high,
      notes: ["SELL pucuk lokal (bukan tengah)."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.7,
      notes: ["Local top fade after upswing."],
    },
  };
}

/**
 * BUY di dasar lokal: turun dulu → hijau reject dekat low window.
 */
function localBottomBuy(
  candles: CandleLike[],
  from: number,
  closed: number,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - SWING_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 4) return waitingBuy("Local bottom: need more bars.");

  const last = candles[closed];
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const span = winHigh - winLow;
  if (span < atr * MIN_SPAN_ATR) {
    return waitingBuy("Local bottom: swing terlalu tipis.", 0, winLow);
  }

  const first = win[0];
  if (!(winLow <= first.low - atr * 0.2 || last.low <= first.close - atr * 0.25)) {
    return waitingBuy("Local bottom: belum ada turun ke dasar lokal.", 0, winLow);
  }

  if (last.close - winLow > atr * EXTREME_CLOSE_ATR) {
    return waitingBuy("Local bottom: sudah jauh dari dasar — jangan kejar.", 0, winLow);
  }
  if (last.low - winLow > atr * 0.35) {
    return waitingBuy("Local bottom: low sudah lewat.", 0, winLow);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectBottom =
    isBullishCandle(last) &&
    (lowerWick(last) >= barRange * 0.15 || last.close >= rangeMid(last) || bodySize(last) >= atr * 0.12);
  if (!rejectBottom) {
    return waitingBuy("Local bottom: nunggu candle hijau reject di dasar.", 0, winLow);
  }

  const depth = Math.min(0.55, span / Math.max(atr * 2.5, span));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.low,
      notes: ["Local swing bottom — BUY di dasar lokal."],
    },
    rejection: {
      detected: true,
      side: "bullish",
      atPrice: last.low,
      notes: ["BUY dasar lokal (bukan tengah)."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.7,
      notes: ["Local bottom bounce after downswing."],
    },
  };
}
