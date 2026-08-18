/**
 * Sequenced M1 setup — scalping cepat & akurat:
 * 1) Pullback dangkal ikut tekanan (BUY di merah / SELL di hijau)
 * 2) Exhaustion di ekstrem: SELL di pucuk spike, BUY di dasar dump
 * Tidak wajib nunggu S/R. M5 unknown → skip.
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
const SHALLOW_MAX_DEPTH = 0.55;
const PRIOR_BARS = 6;
/** Window untuk deteksi spike/dump sebelum exhaustion. */
const EXTREME_BARS = 10;

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

  const topFade = topFadeSell(m1Candles, from, closed, config);
  const bottomBounce = bottomBounceBuy(m1Candles, from, closed, config);

  if (trendDirection === "bullish") {
    // Ikut naik + boleh SELL di pucuk spike (cepat baca atas)
    return pickBest(
      bullishShallowPullback(m1Candles, from, closed, config),
      topFade,
      bottomBounce,
    );
  }
  if (trendDirection === "bearish") {
    // Ikut turun + boleh BUY di dasar dump (cepat baca bawah)
    return pickBest(
      bearishShallowPullback(m1Candles, from, closed, config),
      topFade,
      bottomBounce,
    );
  }
  // sideways — semua jalur scalp
  return pickBest(
    bullishShallowPullback(m1Candles, from, closed, config),
    bearishShallowPullback(m1Candles, from, closed, config),
    topFade,
    bottomBounce,
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
    if (setupScore(setups[i]) > setupScore(best)) best = setups[i];
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
      notes: ["Need shallow red pullback after green pressure."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Need bullish M1 pressure first."],
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
      notes: ["Need shallow green pullback after red pressure."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Need bearish M1 pressure first."],
    },
  };
}

/**
 * SELL di atas: spike naik tajam → candle pucuk macet/merah dekat high lokal.
 */
function topFadeSell(
  candles: CandleLike[],
  from: number,
  closed: number,
  _config: TradingAiConfig,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - EXTREME_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 5) return waitingSell("Top fade: need more bars.");

  const last = candles[closed];
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const span = winHigh - winLow;
  if (span < atr * 1.15) {
    return waitingSell("Top fade: no sharp spike up yet.", 0, winHigh);
  }

  const first = win[0];
  const netUp = last.close > first.open || winHigh > first.high + atr * 0.6;
  if (!netUp) return waitingSell("Top fade: window not an up-spike.", 0, winHigh);

  // Harus di zona pucuk (dekat high window)
  if (winHigh - last.high > atr * 0.35 && winHigh - last.close > atr * 0.45) {
    return waitingSell("Top fade: price left the top already.", 0, winHigh);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const stall =
    isBearishCandle(last) ||
    (upperWick(last) >= barRange * 0.35 && last.close <= rangeMid(last)) ||
    bodySize(last) <= atr * 0.25;
  if (!stall) {
    return waitingSell("Top fade: waiting for stall/red at the high.", 0, winHigh);
  }

  const depth = Math.min(0.5, span / Math.max(atr * 3, span));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.high,
      notes: ["Exhaustion top fade — sharp up then stall at high."],
    },
    rejection: {
      detected: true,
      side: "bearish",
      atPrice: last.high,
      notes: ["SELL di pucuk — baca cepat atas."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.72,
      notes: ["Exhaustion: sell the top after spike."],
    },
  };
}

/**
 * BUY di bawah: dump tajam → candle dasar macet/hijau dekat low lokal.
 */
function bottomBounceBuy(
  candles: CandleLike[],
  from: number,
  closed: number,
  _config: TradingAiConfig,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const winFrom = Math.max(from, closed - EXTREME_BARS);
  const win = candles.slice(winFrom, closed + 1);
  if (win.length < 5) return waitingBuy("Bottom bounce: need more bars.");

  const last = candles[closed];
  const winHigh = Math.max(...win.map((c) => c.high));
  const winLow = Math.min(...win.map((c) => c.low));
  const span = winHigh - winLow;
  if (span < atr * 1.15) {
    return waitingBuy("Bottom bounce: no sharp dump yet.", 0, winLow);
  }

  const first = win[0];
  const netDown = last.close < first.open || winLow < first.low - atr * 0.6;
  if (!netDown) return waitingBuy("Bottom bounce: window not a dump.", 0, winLow);

  if (last.low - winLow > atr * 0.35 && last.close - winLow > atr * 0.45) {
    return waitingBuy("Bottom bounce: price left the low already.", 0, winLow);
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const stall =
    isBullishCandle(last) ||
    (lowerWick(last) >= barRange * 0.35 && last.close >= rangeMid(last)) ||
    bodySize(last) <= atr * 0.25;
  if (!stall) {
    return waitingBuy("Bottom bounce: waiting for stall/green at the low.", 0, winLow);
  }

  const depth = Math.min(0.5, span / Math.max(atr * 3, span));
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.low,
      notes: ["Exhaustion bottom bounce — sharp dump then stall at low."],
    },
    rejection: {
      detected: true,
      side: "bullish",
      atPrice: last.low,
      notes: ["BUY di dasar — baca cepat bawah."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.72,
      notes: ["Exhaustion: buy the bottom after dump."],
    },
  };
}

/**
 * BUY: tekanan hijau di M1 → candle merah dangkal (last closed) → entry di situ.
 */
function bullishShallowPullback(
  candles: CandleLike[],
  from: number,
  closed: number,
  config: TradingAiConfig,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const last = candles[closed];

  if (!isBearishCandle(last)) {
    return waitingBuy("Waiting for shallow red pullback (buy the dip).");
  }

  const priorFrom = Math.max(from, closed - PRIOR_BARS);
  const prior = candles.slice(priorFrom, closed);
  if (prior.length < 3) {
    return waitingBuy("Need more M1 bars for bullish pressure.");
  }

  const bullishCount = prior.filter(isBullishCandle).length;
  const netUp = prior[prior.length - 1].close > prior[0].open;
  const pressure = bullishCount >= 2 && netUp;
  if (!pressure) {
    return waitingBuy("No clear M1 green pressure yet — skip buy.");
  }

  const impulseLow = Math.min(...prior.map((c) => c.low));
  const impulseHigh = Math.max(...prior.map((c) => c.high), last.high);
  const impulseRange = Math.max(impulseHigh - impulseLow, atr * 0.8);
  const depth = (impulseHigh - last.low) / impulseRange;
  const maxDepth = Math.min(config.brain.pullbackMaxDepth, SHALLOW_MAX_DEPTH);
  const pullSpan = impulseHigh - last.low;

  if (pullSpan < atr * 0.1) {
    return waitingBuy("Red bar too tiny — noise, not a pullback.", depth, last.low);
  }
  if (pullSpan > atr * 2.2 || bodySize(last) > atr * 2) {
    return waitingBuy("Pullback too deep/violent — moment already gone.", depth, last.low);
  }
  if (depth < config.brain.pullbackMinDepth || depth > maxDepth) {
    return waitingBuy(
      `Pullback depth ${(depth * 100).toFixed(0)}% outside shallow band.`,
      depth,
      last.low,
    );
  }

  const strength = Math.min(1, 0.55 + bullishCount * 0.1);
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.low,
      notes: [
        `Shallow red pullback after green pressure (depth ${(depth * 100).toFixed(0)}%).`,
      ],
    },
    rejection: {
      detected: true,
      side: "bullish",
      atPrice: last.low,
      notes: ["Enter BUY on red pullback — not after green resume."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength,
      notes: ["Prior M1 bullish pressure OK — buy the shallow dip."],
    },
  };
}

/**
 * SELL: tekanan merah di M1 → candle hijau dangkal (last closed) → entry di situ.
 */
function bearishShallowPullback(
  candles: CandleLike[],
  from: number,
  closed: number,
  config: TradingAiConfig,
): SequencedSetup {
  const atr = atrApprox(candles) || candles[closed].close * 0.001;
  const last = candles[closed];

  if (!isBullishCandle(last)) {
    return waitingSell("Waiting for shallow green pullback (sell the rally).");
  }

  const priorFrom = Math.max(from, closed - PRIOR_BARS);
  const prior = candles.slice(priorFrom, closed);
  if (prior.length < 3) {
    return waitingSell("Need more M1 bars for bearish pressure.");
  }

  const bearishCount = prior.filter(isBearishCandle).length;
  const netDown = prior[prior.length - 1].close < prior[0].open;
  const pressure = bearishCount >= 2 && netDown;
  if (!pressure) {
    return waitingSell("No clear M1 red pressure yet — skip sell.");
  }

  const impulseHigh = Math.max(...prior.map((c) => c.high));
  const impulseLow = Math.min(...prior.map((c) => c.low), last.low);
  const impulseRange = Math.max(impulseHigh - impulseLow, atr * 0.8);
  const depth = (last.high - impulseLow) / impulseRange;
  const maxDepth = Math.min(config.brain.pullbackMaxDepth, SHALLOW_MAX_DEPTH);
  const pullSpan = last.high - impulseLow;

  if (pullSpan < atr * 0.1) {
    return waitingSell("Green bar too tiny — noise, not a pullback.", depth, last.high);
  }
  if (pullSpan > atr * 2.2 || bodySize(last) > atr * 2) {
    return waitingSell("Pullback too deep/violent — moment already gone.", depth, last.high);
  }
  if (depth < config.brain.pullbackMinDepth || depth > maxDepth) {
    return waitingSell(
      `Pullback depth ${(depth * 100).toFixed(0)}% outside shallow band.`,
      depth,
      last.high,
    );
  }

  const strength = Math.min(1, 0.55 + bearishCount * 0.1);
  return {
    pullback: {
      detected: true,
      depth,
      nearLevel: last.high,
      notes: [
        `Shallow green pullback after red pressure (depth ${(depth * 100).toFixed(0)}%).`,
      ],
    },
    rejection: {
      detected: true,
      side: "bearish",
      atPrice: last.high,
      notes: ["Enter SELL on green pullback — not after red resume."],
    },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength,
      notes: ["Prior M1 bearish pressure OK — sell the shallow rally."],
    },
  };
}
