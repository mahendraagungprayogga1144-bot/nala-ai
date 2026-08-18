/**
 * Sequenced M1 setup: pullback → rejection → momentum (with M5 bias).
 * Avoids requiring all three on the same latest bar (which almost never fires).
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
  findSwings,
  isBearishCandle,
  isBullishCandle,
  lastClosedIndex,
  lastSwings,
  lowerWick,
  nearLevel,
  rangeMid,
  upperWick,
} from "./price-action";

export type SequencedSetup = {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
};

const LOOKBACK = 80;

export function detectSequencedSetup(
  m1Candles: CandleLike[],
  trendDirection: TrendDirection,
  config: TradingAiConfig,
  sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  // unknown = belum cukup struktur → jangan hunt.
  // sideways = range / kotak S/R → boleh hunt BUY & SELL dari M1.
  if (trendDirection === "unknown") {
    return emptySetup("No directional bias — skip M1 hunt.");
  }
  if (m1Candles.length < config.brain.minM1Candles) {
    return emptySetup(`Need at least ${config.brain.minM1Candles} M1 candles.`);
  }

  const atr = atrApprox(m1Candles) || m1Candles[m1Candles.length - 1].close * 0.001;
  const touchTol = Math.max(atr * config.brain.levelTouchAtrMult, atr * 0.5);
  const closed = lastClosedIndex(m1Candles);
  const from = Math.max(0, closed - LOOKBACK + 1);
  const swings = findSwings(m1Candles, config.brain.swingLeft, config.brain.swingRight);

  if (trendDirection === "bullish") {
    return bullishSequence(m1Candles, swings, from, closed, touchTol, config, sr);
  }
  if (trendDirection === "bearish") {
    return bearishSequence(m1Candles, swings, from, closed, touchTol, config, sr);
  }
  // sideways — scalp di dalam kotak S/R: pilih setup M1 yang lebih matang.
  return rangeBoxSequence(m1Candles, swings, from, closed, touchTol, config, sr);
}

function setupScore(s: SequencedSetup): number {
  return (
    (s.pullback.detected ? 1 : 0) +
    (s.rejection.detected ? 1 : 0) +
    (s.momentum.alignedWithTrend ? 1 : 0) +
    s.momentum.strength * 0.1
  );
}

/** M5 sideways: coba long & short di S/R, ambil yang paling lengkap. */
function rangeBoxSequence(
  candles: CandleLike[],
  swings: ReturnType<typeof findSwings>,
  from: number,
  closed: number,
  touchTol: number,
  config: TradingAiConfig,
  sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  const bull = bullishSequence(candles, swings, from, closed, touchTol, config, sr);
  const bear = bearishSequence(candles, swings, from, closed, touchTol, config, sr);
  const pick = setupScore(bear) > setupScore(bull) ? bear : bull;
  const note = "M5 sideways — range box scalp (M1 S/R momentum).";
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

/**
 * Pilih tolok ukur depth.
 * Pada basis "level", depth diukur ke S/R yang juga harus disentuh, sehingga
 * nilainya selalu mendekati 1 — batas atas dinaikkan ke 1 supaya detektor
 * tidak menolak semua pullback. Basis "impulse" memakai panjang kaki impuls,
 * sehingga pullbackMaxDepth benar-benar menyaring retracement penuh.
 */
function depthBasis(
  config: TradingAiConfig,
  levelRange: number,
  impulseRange: number,
): { depthRange: number; maxDepth: number } {
  if (config.brain.pullbackDepthBasis === "impulse") {
    return { depthRange: impulseRange, maxDepth: config.brain.pullbackMaxDepth };
  }
  return { depthRange: levelRange, maxDepth: Math.max(config.brain.pullbackMaxDepth, 1) };
}

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

function bullishSequence(
  candles: CandleLike[],
  swings: ReturnType<typeof findSwings>,
  from: number,
  closed: number,
  touchTol: number,
  config: TradingAiConfig,
  sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  const lows = lastSwings(swings, "low", 3);

  // Impulse high = max high before the last few bars (room for pullback/rej/mom).
  const impulseEnd = Math.max(from, closed - 6);
  let swingHighIdx = from;
  let swingHigh = candles[from].high;
  for (let i = from; i <= impulseEnd; i++) {
    if (candles[i].high >= swingHigh) {
      swingHigh = candles[i].high;
      swingHighIdx = i;
    }
  }

  let priorLow = Infinity;
  for (let i = from; i <= swingHighIdx; i++) priorLow = Math.min(priorLow, candles[i].low);
  if (!Number.isFinite(priorLow) || priorLow >= swingHigh) {
    priorLow = swingHigh - Math.max(swingHigh * 0.002, 1);
  }

  const target = sr?.nearestSupport ?? (lows.length ? lows[lows.length - 1].price : priorLow);
  // Depth vs path from impulse high → support (not micro-chop range).
  const range = Math.max(swingHigh - target, atrApprox(candles) * 3, swingHigh * 0.001);
  const { depthRange, maxDepth } = depthBasis(
    config,
    range,
    Math.max(swingHigh - priorLow, atrApprox(candles) * 3, swingHigh * 0.001),
  );

  // 1) Pullback AFTER impulse high into support
  let pullIdx = -1;
  let pullDepth = 0;
  for (let i = swingHighIdx + 1; i <= closed; i++) {
    const c = candles[i];
    const depth = (swingHigh - c.low) / depthRange;
    const touching = nearLevel(c.low, target, touchTol);
    const inBand = depth >= config.brain.pullbackMinDepth && depth <= maxDepth;
    if (touching && inBand) {
      pullIdx = i;
      pullDepth = depth;
      break;
    }
  }

  if (pullIdx < 0) {
    const last = candles[closed];
    const depth = (swingHigh - last.low) / depthRange;
    return {
      pullback: {
        detected: false,
        depth,
        nearLevel: target,
        notes: [`Waiting for bullish pullback into ~${target.toFixed(2)}.`],
      },
      rejection: {
        detected: false,
        side: null,
        atPrice: null,
        notes: ["Need pullback before rejection."],
      },
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0,
        notes: ["Need pullback before momentum."],
      },
    };
  }

  const pullback: PullbackAnalysis = {
    detected: true,
    depth: pullDepth,
    nearLevel: target,
    notes: [
      `Bullish pullback at bar ${pullIdx} depth ${(pullDepth * 100).toFixed(0)}% into ~${target.toFixed(2)}.`,
    ],
  };

  // 2) Rejection at/after pullback — pin wick OR strong bounce off support
  let rejIdx = -1;
  for (let i = pullIdx; i <= closed; i++) {
    const c = candles[i];
    const body = bodySize(c);
    const barRange = Math.max(c.high - c.low, 1e-9);
    const wick = Math.max(0, lowerWick(c));
    const touched = nearLevel(c.low, target, touchTol);
    const longWick = wick >= Math.max(body * 0.9, barRange * 0.28);
    const closesStrong = c.close >= rangeMid(c) || isBullishCandle(c);
    const bounceOffLow =
      isBullishCandle(c) && c.close >= c.low + barRange * 0.55 && touched;
    if (touched && ((longWick && closesStrong) || bounceOffLow)) {
      rejIdx = i;
      break;
    }
  }

  if (rejIdx < 0) {
    return {
      pullback,
      rejection: {
        detected: false,
        side: null,
        atPrice: null,
        notes: ["Pullback seen — waiting for bullish rejection wick."],
      },
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0,
        notes: ["Need rejection before momentum."],
      },
    };
  }

  const rej = candles[rejIdx];
  const rejection: RejectionAnalysis = {
    detected: true,
    side: "bullish",
    atPrice: rej.low,
    notes: [`Bullish rejection at bar ${rejIdx} low ${rej.low.toFixed(2)}.`],
  };

  // 3) Momentum after rejection
  const momFrom = rejIdx + 1;
  const momTo = closed;
  if (momTo < momFrom) {
    return {
      pullback,
      rejection,
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0.15,
        notes: ["Rejection seen — waiting for bullish continuation candles."],
      },
    };
  }

  const window = candles.slice(momFrom, momTo + 1).slice(-4);
  const bullishCount = window.filter(isBullishCandle).length;
  const higherCloses = window[window.length - 1].close > rej.close;
  const avgBody = window.reduce((s, c) => s + bodySize(c), 0) / window.length;
  const expanding = bodySize(window[window.length - 1]) >= avgBody * 0.8;
  const aligned =
    window.length >= 1 &&
    bullishCount >= Math.ceil(window.length / 2) &&
    higherCloses &&
    expanding;

  const momentum: MomentumAnalysis = {
    alignedWithTrend: aligned,
    direction: aligned ? "bullish" : "unknown",
    strength: aligned ? Math.min(1, 0.55 + bullishCount * 0.12) : 0.25,
    notes: aligned
      ? ["M1 momentum resumed bullish after rejection."]
      : ["Waiting for bullish displacement after rejection."],
  };

  return { pullback, rejection, momentum };
}

function bearishSequence(
  candles: CandleLike[],
  swings: ReturnType<typeof findSwings>,
  from: number,
  closed: number,
  touchTol: number,
  config: TradingAiConfig,
  sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  const highs = lastSwings(swings, "high", 3);

  const impulseEnd = Math.max(from, closed - 6);
  let swingLowIdx = from;
  let swingLow = candles[from].low;
  for (let i = from; i <= impulseEnd; i++) {
    if (candles[i].low <= swingLow) {
      swingLow = candles[i].low;
      swingLowIdx = i;
    }
  }

  let priorHigh = -Infinity;
  for (let i = from; i <= swingLowIdx; i++) priorHigh = Math.max(priorHigh, candles[i].high);
  if (!Number.isFinite(priorHigh) || priorHigh <= swingLow) {
    priorHigh = swingLow + Math.max(swingLow * 0.002, 1);
  }

  const target = sr?.nearestResistance ?? (highs.length ? highs[highs.length - 1].price : priorHigh);
  const range = Math.max(target - swingLow, atrApprox(candles) * 3, swingLow * 0.001);
  const { depthRange, maxDepth } = depthBasis(
    config,
    range,
    Math.max(priorHigh - swingLow, atrApprox(candles) * 3, swingLow * 0.001),
  );

  let pullIdx = -1;
  let pullDepth = 0;
  for (let i = swingLowIdx + 1; i <= closed; i++) {
    const c = candles[i];
    const depth = (c.high - swingLow) / depthRange;
    const touching = nearLevel(c.high, target, touchTol);
    const inBand = depth >= config.brain.pullbackMinDepth && depth <= maxDepth;
    if (touching && inBand) {
      pullIdx = i;
      pullDepth = depth;
      break;
    }
  }

  if (pullIdx < 0) {
    const last = candles[closed];
    const depth = (last.high - swingLow) / depthRange;
    return {
      pullback: {
        detected: false,
        depth,
        nearLevel: target,
        notes: [`Waiting for bearish pullback into ~${target.toFixed(2)}.`],
      },
      rejection: {
        detected: false,
        side: null,
        atPrice: null,
        notes: ["Need pullback before rejection."],
      },
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0,
        notes: ["Need pullback before momentum."],
      },
    };
  }

  const pullback: PullbackAnalysis = {
    detected: true,
    depth: pullDepth,
    nearLevel: target,
    notes: [
      `Bearish pullback at bar ${pullIdx} depth ${(pullDepth * 100).toFixed(0)}% into ~${target.toFixed(2)}.`,
    ],
  };

  let rejIdx = -1;
  for (let i = pullIdx; i <= closed; i++) {
    const c = candles[i];
    const body = bodySize(c);
    const barRange = Math.max(c.high - c.low, 1e-9);
    const wick = Math.max(0, upperWick(c));
    const touched = nearLevel(c.high, target, touchTol);
    const longWick = wick >= Math.max(body * 0.9, barRange * 0.28);
    const closesStrong = c.close <= rangeMid(c) || isBearishCandle(c);
    const bounceOffHigh =
      isBearishCandle(c) && c.close <= c.high - barRange * 0.55 && touched;
    if (touched && ((longWick && closesStrong) || bounceOffHigh)) {
      rejIdx = i;
      break;
    }
  }

  if (rejIdx < 0) {
    return {
      pullback,
      rejection: {
        detected: false,
        side: null,
        atPrice: null,
        notes: ["Pullback seen — waiting for bearish rejection wick."],
      },
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0,
        notes: ["Need rejection before momentum."],
      },
    };
  }

  const rej = candles[rejIdx];
  const rejection: RejectionAnalysis = {
    detected: true,
    side: "bearish",
    atPrice: rej.high,
    notes: [`Bearish rejection at bar ${rejIdx} high ${rej.high.toFixed(2)}.`],
  };

  const momFrom = rejIdx + 1;
  const momTo = closed;
  if (momTo < momFrom) {
    return {
      pullback,
      rejection,
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0.15,
        notes: ["Rejection seen — waiting for bearish continuation candles."],
      },
    };
  }

  const window = candles.slice(momFrom, momTo + 1).slice(-4);
  const bearishCount = window.filter(isBearishCandle).length;
  const lowerCloses = window[window.length - 1].close < rej.close;
  const avgBody = window.reduce((s, c) => s + bodySize(c), 0) / window.length;
  const expanding = bodySize(window[window.length - 1]) >= avgBody * 0.8;
  const aligned =
    window.length >= 1 &&
    bearishCount >= Math.ceil(window.length / 2) &&
    lowerCloses &&
    expanding;

  const momentum: MomentumAnalysis = {
    alignedWithTrend: aligned,
    direction: aligned ? "bearish" : "unknown",
    strength: aligned ? Math.min(1, 0.55 + bearishCount * 0.12) : 0.25,
    notes: aligned
      ? ["M1 momentum resumed bearish after rejection."]
      : ["Waiting for bearish displacement after rejection."],
  };

  return { pullback, rejection, momentum };
}
