/**
 * Sequenced M1 — ikut arah M5, tapi bisa ganti saat struktur pecah (RANGE).
 * Trending: BUY dip / SELL bounce (lanjutan), plus fade di tepi swing lokal.
 * Jangan kejar tengah: dump tanpa bounce ≠ SELL, rally tanpa dip ≠ BUY.
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
/** Bounce/dip pendek di dalam trend — 5 bar, bukan nunggu upswing 8 bar. */
const BOUNCE_BARS = 4;
const MIN_BOUNCE_ATR = 0.22;
const NEAR_EXTREME_ATR = 0.45;

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
    return pickBest(
      dipResumeBuy(m1Candles, from, closed),
      localBottomBuy(m1Candles, from, closed),
    );
  }
  if (trendDirection === "bearish") {
    return pickBest(
      bounceResumeSell(m1Candles, from, closed),
      localTopSell(m1Candles, from, closed),
    );
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

/**
 * SELL bounce pendek di M5 bearish: 1–3 bar naik, lalu merah di pucuk bounce.
 * Tidak nunggu upswing 8 bar (itu yang bikin SCAN selamanya saat dump).
 */
function bounceResumeSell(
  candles: CandleLike[],
  from: number,
  closed: number,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - BOUNCE_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 4) return waitingSell("Bounce SELL: need more bars.");

  const last = candles[closed];
  const prior = win.slice(0, -1);
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const bounceHigh = Math.max(...prior.map((c) => c.high));
  const bounceLow = Math.min(...prior.map((c) => c.low));
  const bounceSpan = bounceHigh - bounceLow;

  if (!prior.some(isBullishCandle)) {
    return waitingSell("Bounce SELL: belum ada naik M1 — jangan kejar dump.", 0, winHigh);
  }
  if (bounceSpan < atr * MIN_BOUNCE_ATR) {
    return waitingSell("Bounce SELL: bounce terlalu tipis.", 0, winHigh);
  }
  if (!isBearishCandle(last)) {
    return waitingSell("Bounce SELL: nunggu candle merah di pucuk bounce.", 0, winHigh);
  }
  const nearHigh = Math.max(atr * NEAR_EXTREME_ATR, bounceSpan * 0.35);
  const maxAway = Math.max(atr * 0.95, bounceSpan * 0.7);
  if (winHigh - last.high > nearHigh) {
    return waitingSell("Bounce SELL: high bounce sudah lewat — jangan kejar.", 0, winHigh);
  }
  if (winHigh - last.close > maxAway) {
    return waitingSell("Bounce SELL: sudah jauh dari pucuk bounce.", 0, winHigh);
  }
  if (last.close - winLow < Math.min(atr * 0.12, bounceSpan * 0.2)) {
    return waitingSell("Bounce SELL: sudah di dasar window — jangan kejar dump.", 0, winHigh);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectTop =
    upperWick(last) >= barRange * 0.12 ||
    last.close <= rangeMid(last) ||
    bodySize(last) >= atr * 0.1;
  if (!rejectTop) {
    return waitingSell("Bounce SELL: candle merah belum reject pucuk.", 0, winHigh);
  }

  const depth = Math.min(0.5, bounceSpan / Math.max(atr * 2.2, bounceSpan));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.high,
      notes: ["M5 bearish — SELL bounce M1 (bukan kejar dump)."],
    },
    rejection: {
      detected: true,
      side: "bearish",
      atPrice: last.high,
      notes: ["Red resume after short M1 bounce."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.64,
      notes: ["Trend continuation: sell the bounce."],
    },
  };
}

/**
 * BUY dip pendek di M5 bullish: 1–3 bar turun, lalu hijau di dasar dip.
 */
function dipResumeBuy(
  candles: CandleLike[],
  from: number,
  closed: number,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - BOUNCE_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 4) return waitingBuy("Dip BUY: need more bars.");

  const last = candles[closed];
  const prior = win.slice(0, -1);
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const dipHigh = Math.max(...prior.map((c) => c.high));
  const dipLow = Math.min(...prior.map((c) => c.low));
  const dipSpan = dipHigh - dipLow;

  if (!prior.some(isBearishCandle)) {
    return waitingBuy("Dip BUY: belum ada turun M1 — jangan kejar rally.", 0, winLow);
  }
  if (dipSpan < atr * MIN_BOUNCE_ATR) {
    return waitingBuy("Dip BUY: dip terlalu tipis.", 0, winLow);
  }
  if (!isBullishCandle(last)) {
    return waitingBuy("Dip BUY: nunggu candle hijau di dasar dip.", 0, winLow);
  }
  const nearLow = Math.max(atr * NEAR_EXTREME_ATR, dipSpan * 0.35);
  const maxAway = Math.max(atr * 0.95, dipSpan * 0.7);
  if (last.low - winLow > nearLow) {
    return waitingBuy("Dip BUY: low dip sudah lewat — jangan kejar.", 0, winLow);
  }
  if (last.close - winLow > maxAway) {
    return waitingBuy("Dip BUY: sudah jauh dari dasar dip.", 0, winLow);
  }
  if (winHigh - last.close < Math.min(atr * 0.12, dipSpan * 0.2)) {
    return waitingBuy("Dip BUY: sudah di pucuk window — jangan kejar rally.", 0, winLow);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectBottom =
    lowerWick(last) >= barRange * 0.12 ||
    last.close >= rangeMid(last) ||
    bodySize(last) >= atr * 0.1;
  if (!rejectBottom) {
    return waitingBuy("Dip BUY: candle hijau belum reject dasar.", 0, winLow);
  }

  const depth = Math.min(0.5, dipSpan / Math.max(atr * 2.2, dipSpan));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.low,
      notes: ["M5 bullish — BUY dip M1 (bukan kejar rally)."],
    },
    rejection: {
      detected: true,
      side: "bullish",
      atPrice: last.low,
      notes: ["Green resume after short M1 dip."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.64,
      notes: ["Trend continuation: buy the dip."],
    },
  };
}
