/**
 * Sequenced M1 — perampok ekstrem saja:
 * BUY hanya di dasar dump (stall dekat low),
 * SELL hanya di pucuk spike (stall dekat high).
 * Tidak kejar tengah jalan / pullback jauh dari ekstrem.
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
const EXTREME_BARS = 12;
/** Dekat ekstrem: close harus dalam band ini dari high/low window. */
const EXTREME_CLOSE_ATR = 0.85;

export function detectSequencedSetup(
  m1Candles: CandleLike[],
  trendDirection: TrendDirection,
  config: TradingAiConfig,
  _sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  if (trendDirection === "unknown") {
    return emptySetup("No directional bias — skip M1 hunt.");
  }
  if (m1Candles.length < config.brain.minM1Candles) {
    return emptySetup(`Need at least ${config.brain.minM1Candles} M1 candles.`);
  }

  const closed = lastClosedIndex(m1Candles);
  const from = Math.max(0, closed - LOOKBACK + 1);

  // Hanya jalur ekstrem — jangan rampok di tengah.
  return pickBest(
    topFadeSell(m1Candles, from, closed),
    bottomBounceBuy(m1Candles, from, closed),
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
    // Kalau skor sama, pilih yang detected (hindari pesan WAIT jalur lain).
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
      notes: ["Need stall at the low (BUY dasar)."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Waiting for bottom extreme."],
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
      notes: ["Need stall at the high (SELL pucuk)."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Waiting for top extreme."],
    },
  };
}

/**
 * SELL di pucuk: spike naik → candle MERAH dekat high (bukan kejar tengah).
 */
function topFadeSell(
  candles: CandleLike[],
  from: number,
  closed: number,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - EXTREME_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 5) return waitingSell("Top fade: need more bars.");

  const last = candles[closed];
  const prev = closed > 0 ? candles[closed - 1] : last;
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const span = winHigh - winLow;
  if (span < atr * 1.2) {
    return waitingSell("Top fade: no sharp spike up yet.", 0, winHigh);
  }

  const first = win[0];
  if (!(winHigh > first.high + atr * 0.5)) {
    return waitingSell("Top fade: window not an up-spike.", 0, winHigh);
  }

  // Masih di zona pucuk — kalau sudah turun jauh dari high, momen lewat.
  if (winHigh - last.close > atr * EXTREME_CLOSE_ATR) {
    return waitingSell("Top fade: left the top — jangan kejar SELL.", 0, winHigh);
  }
  if (winHigh - last.high > atr * 0.2) {
    return waitingSell("Top fade: high already away from window peak.", 0, winHigh);
  }

  // Wajib rejection bearish di pucuk (bukan doji kecil di tengah naik).
  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectTop =
    isBearishCandle(last) &&
    (upperWick(last) >= barRange * 0.2 || last.close <= rangeMid(last));
  if (!rejectTop) {
    return waitingSell("Top fade: need red rejection at the high.", 0, winHigh);
  }

  // Kalau bar sebelumnya masih HH kuat tanpa pelemahan, jangan gas dulu.
  if (isBullishCandle(prev) && prev.close > prev.open + atr * 0.35 && last.high > prev.high) {
    if (bodySize(last) < atr * 0.15) {
      return waitingSell("Top fade: still climbing — wait clearer red.", 0, winHigh);
    }
  }

  const depth = Math.min(0.5, span / Math.max(atr * 3, span));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.high,
      notes: ["Exhaustion top — SELL hanya di pucuk."],
    },
    rejection: {
      detected: true,
      side: "bearish",
      atPrice: last.high,
      notes: ["SELL di pucuk ekstrem."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.78,
      notes: ["Exhaustion: sell the top after spike."],
    },
  };
}

/**
 * BUY di dasar: dump tajam → candle HIJAU dekat low (bukan kejar naik).
 */
function bottomBounceBuy(
  candles: CandleLike[],
  from: number,
  closed: number,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - EXTREME_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 5) return waitingBuy("Bottom bounce: need more bars.");

  const last = candles[closed];
  const prev = closed > 0 ? candles[closed - 1] : last;
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const span = winHigh - winLow;
  if (span < atr * 1.2) {
    return waitingBuy("Bottom bounce: no sharp dump yet.", 0, winLow);
  }

  const first = win[0];
  if (!(winLow < first.low - atr * 0.5)) {
    return waitingBuy("Bottom bounce: window not a dump.", 0, winLow);
  }

  if (last.close - winLow > atr * EXTREME_CLOSE_ATR) {
    return waitingBuy("Bottom bounce: left the low — jangan kejar BUY.", 0, winLow);
  }
  if (last.low - winLow > atr * 0.2) {
    return waitingBuy("Bottom bounce: low already away from window floor.", 0, winLow);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectBottom =
    isBullishCandle(last) &&
    (lowerWick(last) >= barRange * 0.2 || last.close >= rangeMid(last));
  if (!rejectBottom) {
    return waitingBuy("Bottom bounce: need green rejection at the low.", 0, winLow);
  }

  if (isBearishCandle(prev) && prev.open > prev.close + atr * 0.35 && last.low < prev.low) {
    if (bodySize(last) < atr * 0.15) {
      return waitingBuy("Bottom bounce: still dumping — wait clearer green.", 0, winLow);
    }
  }

  const depth = Math.min(0.5, span / Math.max(atr * 3, span));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.low,
      notes: ["Exhaustion bottom — BUY hanya di dasar."],
    },
    rejection: {
      detected: true,
      side: "bullish",
      atPrice: last.low,
      notes: ["BUY di dasar ekstrem."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.78,
      notes: ["Exhaustion: buy the bottom after dump."],
    },
  };
}
