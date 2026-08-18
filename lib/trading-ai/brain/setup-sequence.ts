/**
 * Sequenced M1 setup — scalping "perampok market":
 * M5 bias + tekanan arah di M1 → entry di pullback dangkal lawan
 * (BUY di candle merah setelah hijau; SELL di candle hijau setelah merah).
 * Tidak wajib nunggu sampai S/R (biar gak ketinggalan kereta).
 * Tidak nunggu candle lanjut tren (itu bikin entry telat + floating gede).
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
} from "./price-action";

export type SequencedSetup = {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
};

const LOOKBACK = 80;
/** Max retrace dalam kaki impuls — lebih dalam = kejar ke S/R / ketinggalan momen. */
const SHALLOW_MAX_DEPTH = 0.55;
const PRIOR_BARS = 6;

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

  if (trendDirection === "bullish") {
    return bullishShallowPullback(m1Candles, from, closed, config);
  }
  if (trendDirection === "bearish") {
    return bearishShallowPullback(m1Candles, from, closed, config);
  }
  // sideways — scalp dua arah dari tekanan M1 + pullback dangkal
  return rangeBoxSequence(m1Candles, from, closed, config);
}

function setupScore(s: SequencedSetup): number {
  return (
    (s.pullback.detected ? 1 : 0) +
    (s.rejection.detected ? 1 : 0) +
    (s.momentum.alignedWithTrend ? 1 : 0) +
    s.momentum.strength * 0.1
  );
}

/** M5 sideways: coba long & short, ambil setup M1 yang lebih matang. */
function rangeBoxSequence(
  candles: CandleLike[],
  from: number,
  closed: number,
  config: TradingAiConfig,
): SequencedSetup {
  const bull = bullishShallowPullback(candles, from, closed, config);
  const bear = bearishShallowPullback(candles, from, closed, config);
  const pick = setupScore(bear) > setupScore(bull) ? bear : bull;
  const note = "M5 sideways — shallow M1 pullback scalp.";
  return {
    pullback: {
      ...pick.pullback,
      notes: [note, ...(pick.pullback.notes ?? [])].slice(0, 3),
    },
    rejection: pick.rejection,
    momentum: {
      ...pick.momentum,
      notes: [note, ...(pick.momentum.notes ?? [])].slice(0, 3),
    },
  };
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

  // Noise terlalu kecil, atau dump terlalu dalam (ke support jauh).
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
