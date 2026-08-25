/**
 * Sequenced M1 — human-style chain:
 * PULLBACK → REJECTION (near S/R) → MOMENTUM.
 * RANGE: near resistance = SELL hunt; near support = BUY hunt; middle = WAIT.
 * Trending: bounce SELL at resistance / dip BUY at support (local fallback if S/R thin).
 */

import type { TradingAiConfig } from "../config";
import type {
  Candle,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SupportResistanceAnalysis,
  TrendDirection,
} from "../types";
import { detectMomentum } from "./momentum-detector";
import {
  atrApprox,
  bodySize,
  isBearishCandle,
  isBullishCandle,
  lastClosedIndex,
  lowerWick,
  rangeMid,
  upperWick,
} from "./price-action";
import {
  classifyRangeZone,
  isNearLevel,
  levelTolerance,
} from "./support-resistance";

export type SequencedSetup = {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  /** Working entry level (S/R or local extreme). */
  workingLevel: number | null;
  entryDistance: number | null;
  nearLevel: boolean;
  m1State: "SCAN" | "PULLBACK" | "REJECTION" | "MOMENTUM" | "READY" | "WAIT";
};

const BOUNCE_BARS = 5;
const MIN_BOUNCE_ATR = 0.18;

type CandleLike = Candle;

export function detectSequencedSetup(
  m1Candles: CandleLike[],
  trendDirection: TrendDirection,
  config: TradingAiConfig,
  sr: SupportResistanceAnalysis | null,
): SequencedSetup {
  if (trendDirection === "unknown") {
    return emptySetup("Q1 M5 UNCLEAR — WAIT. No directional bias.");
  }
  if (m1Candles.length < config.brain.minM1Candles) {
    return emptySetup(`Need at least ${config.brain.minM1Candles} M1 candles.`);
  }

  const closed = lastClosedIndex(m1Candles);
  const last = m1Candles[closed];
  const atr = atrApprox(m1Candles) || last.close * 0.001;
  const tol = levelTolerance(atr, config, last.close);
  const support = sr?.nearestSupport ?? null;
  const resistance = sr?.nearestResistance ?? null;

  if (trendDirection === "sideways") {
    const zone = classifyRangeZone(last.close, support, resistance, tol);
    if (zone === "middle") {
      return emptySetup(
        "RANGE middle — WAIT. Hanya tepi box (near support BUY / near resistance SELL).",
      );
    }
    if (zone === "incomplete") {
      return emptySetup("RANGE incomplete S/R — WAIT until box levels clear.");
    }
    if (zone === "near_resistance" || zone === "outside") {
      // Outside above resistance still hunt sell rejection back in.
      return vetoFadeBreakout(
        sellChain(m1Candles, closed, config, resistance, atr, tol, "RANGE"),
        m1Candles,
        closed,
      );
    }
    return vetoFadeBreakout(
      buyChain(m1Candles, closed, config, support, atr, tol, "RANGE"),
      m1Candles,
      closed,
    );
  }

  if (trendDirection === "bearish") {
    return vetoFadeBreakout(
      sellChain(m1Candles, closed, config, resistance, atr, tol, "TREND"),
      m1Candles,
      closed,
    );
  }
  return vetoFadeBreakout(
    buyChain(m1Candles, closed, config, support, atr, tol, "TREND"),
    m1Candles,
    closed,
  );
}

/** Jangan SELL ke rally M1, jangan BUY ke dump yang masih breakdown. */
function vetoFadeBreakout(
  setup: SequencedSetup,
  candles: CandleLike[],
  closed: number,
): SequencedSetup {
  if (!setup.pullback.detected || !setup.rejection.detected) return setup;

  const last = candles[closed];
  const rising = isRisingTape(candles, closed);
  const falling = isFallingTape(candles, closed);

  if (setup.rejection.side === "bearish" && rising) {
    return {
      ...withMeta(
        waitingSell(
          "M1 lagi naik — jangan SELL lawan tape. Nunggu turun/dip, bukan fade breakout.",
          setup.pullback.depth,
          last.high,
        ),
        setup.workingLevel,
        setup.entryDistance,
        false,
        "WAIT",
      ),
    };
  }
  if (setup.rejection.side === "bullish" && falling && isBearishCandle(last)) {
    return {
      ...withMeta(
        waitingBuy(
          "M1 masih breakdown — jangan BUY jatuh. Nunggu stall di dasar.",
          setup.pullback.depth,
          last.low,
        ),
        setup.workingLevel,
        setup.entryDistance,
        false,
        "WAIT",
      ),
    };
  }
  return setup;
}

function tapeWindow(candles: CandleLike[], closed: number): CandleLike[] {
  const n = 16;
  return candles.slice(Math.max(0, closed - n + 1), closed + 1);
}

function isRisingTape(candles: CandleLike[], closed: number): boolean {
  const win = tapeWindow(candles, closed);
  if (win.length < 8) return false;
  const last = candles[closed];
  const atr = atrApprox(candles) || last.close * 0.001;
  const hi = Math.max(...win.map((c) => c.high));
  const lo = Math.min(...win.map((c) => c.low));
  const span = Math.max(hi - lo, atr);
  const pos = (last.close - lo) / span;
  const net = last.close - win[0].close;
  return net >= atr * 0.7 && pos >= 0.55;
}

function isFallingTape(candles: CandleLike[], closed: number): boolean {
  const win = tapeWindow(candles, closed);
  if (win.length < 8) return false;
  const last = candles[closed];
  const atr = atrApprox(candles) || last.close * 0.001;
  const hi = Math.max(...win.map((c) => c.high));
  const lo = Math.min(...win.map((c) => c.low));
  const span = Math.max(hi - lo, atr);
  const pos = (last.close - lo) / span;
  const net = last.close - win[0].close;
  return net <= -atr * 0.7 && pos <= 0.45;
}

function resolveWorkingLevel(
  srLevel: number | null,
  localExtreme: number,
  price: number,
  tol: number,
  mode: "TREND" | "RANGE",
): { level: number; near: boolean } {
  const nearSr =
    srLevel != null &&
    (isNearLevel(price, srLevel, tol) || Math.abs(price - srLevel) <= tol * 1.25);
  const nearLocal = isNearLevel(price, localExtreme, tol) || Math.abs(price - localExtreme) <= tol;

  if (mode === "RANGE") {
    if (srLevel == null) return { level: localExtreme, near: false };
    return { level: srLevel, near: nearSr };
  }

  // TREND: prefer S/R when nearby; else local swing extreme (human local structure).
  if (nearSr && srLevel != null) return { level: srLevel, near: true };
  if (srLevel != null && Math.abs(localExtreme - srLevel) <= tol * 2) {
    return { level: srLevel, near: nearLocal || nearSr };
  }
  return { level: localExtreme, near: nearLocal };
}

function sellChain(
  candles: CandleLike[],
  closed: number,
  config: TradingAiConfig,
  resistance: number | null,
  atr: number,
  tol: number,
  mode: "TREND" | "RANGE",
): SequencedSetup {
  const last = candles[closed];
  const winFrom = Math.max(0, closed - BOUNCE_BARS);
  const win = candles.slice(winFrom, closed + 1);
  const prior = win.slice(0, -1);
  const localHigh = Math.max(...win.map((c) => c.high));
  const resolved = resolveWorkingLevel(resistance, localHigh, last.close, tol, mode);
  const workingLevel = resolved.level;
  const near =
    resolved.near || isNearLevel(last.high, workingLevel, tol);
  const bounceSpan = Math.max(...prior.map((c) => c.high), last.high) - Math.min(...prior.map((c) => c.low), last.low);
  const hadPullbackUp =
    prior.some(isBullishCandle) &&
    bounceSpan >= atr * MIN_BOUNCE_ATR &&
    (localHigh >= (prior[0]?.close ?? last.close) + atr * 0.1);

  const distance = Math.abs(last.close - workingLevel);

  if (!hadPullbackUp) {
    return withMeta(
      waitingSell(
        mode === "RANGE"
          ? "Q3 PULLBACK=NO — RANGE near R, belum ada bounce M1 ke resistance."
          : "Q3 PULLBACK=NO — M5 bearish, nunggu bounce M1 ke resistance. Jangan chase dump.",
        0,
        workingLevel,
      ),
      workingLevel,
      distance,
      near,
      "SCAN",
    );
  }

  if (!near) {
    return withMeta(
      waitingSell(
        `Q6 ENTRY_DISTANCE — harga ${last.close.toFixed(2)} masih jauh dari level ${workingLevel.toFixed(2)} (tol ${tol.toFixed(2)}). WAIT.`,
        Math.min(0.55, bounceSpan / Math.max(atr * 2, bounceSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "PULLBACK",
    );
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectTop =
    isBearishCandle(last) &&
    (upperWick(last) >= barRange * 0.12 ||
      last.close <= rangeMid(last) ||
      bodySize(last) >= atr * 0.1 ||
      (resistance != null && last.close < resistance));

  if (!rejectTop) {
    return withMeta(
      {
        pullback: {
          detected: true,
          depth: Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
          nearLevel: workingLevel,
          notes: ["Q3 PULLBACK=YES — bounce ke resistance / pucuk lokal."],
        },
        rejection: {
          detected: false,
          side: null,
          atPrice: null,
          notes: ["Q4 REJECTION=NO — buyer belum gagal jelas di level."],
        },
        momentum: {
          alignedWithTrend: false,
          direction: "unknown",
          strength: 0,
          notes: ["Q5 MOMENTUM — nunggu rejection dulu."],
        },
      },
      workingLevel,
      distance,
      near,
      "PULLBACK",
    );
  }

  const mom = detectMomentum(candles as Candle[], "bearish");
  const momOk =
    (mom.direction === "bearish" && (mom.alignedWithTrend || mom.strength >= 0.4)) ||
    (isBearishCandle(last) && rejectTop && bodySize(last) >= atr * 0.08 && prior.some(isBullishCandle));

  if (!momOk) {
    return withMeta(
      {
        pullback: {
          detected: true,
          depth: Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
          nearLevel: workingLevel,
          notes: ["Q3 PULLBACK=YES — bounce selesai dekat resistance."],
        },
        rejection: {
          detected: true,
          side: "bearish",
          atPrice: last.high,
          notes: ["Q4 REJECTION=YES — buyer gagal di resistance / pucuk."],
        },
        momentum: {
          alignedWithTrend: false,
          direction: mom.direction,
          strength: mom.strength,
          notes: ["Q5 MOMENTUM=NO — tekanan bearish belum kembali. WAIT."],
        },
      },
      workingLevel,
      distance,
      near,
      "REJECTION",
    );
  }

  // No-chase: already dumped far from level after reject.
  if (workingLevel - last.close > Math.max(atr * 0.85, tol * 1.2)) {
    return withMeta(
      waitingSell(
        `Q6/Q7 CHASE — reject sudah lewat, close ${last.close.toFixed(2)} jauh di bawah level ${workingLevel.toFixed(2)}. WAIT.`,
        Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "WAIT",
    );
  }

  return withMeta(
    {
      pullback: {
        detected: true,
        depth: Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
        nearLevel: workingLevel,
        notes: ["Q3 PULLBACK=YES — bounce ke resistance."],
      },
      rejection: {
        detected: true,
        side: "bearish",
        atPrice: last.high,
        notes: ["Q4 REJECTION=YES — gagal tembus atas."],
      },
      momentum: {
        alignedWithTrend: true,
        direction: "bearish",
        strength: mom.strength,
        notes: mom.notes,
      },
    },
    workingLevel,
    distance,
    near,
    "READY",
  );
}

function buyChain(
  candles: CandleLike[],
  closed: number,
  config: TradingAiConfig,
  support: number | null,
  atr: number,
  tol: number,
  mode: "TREND" | "RANGE",
): SequencedSetup {
  const last = candles[closed];
  const winFrom = Math.max(0, closed - BOUNCE_BARS);
  const win = candles.slice(winFrom, closed + 1);
  const prior = win.slice(0, -1);
  const localLow = Math.min(...win.map((c) => c.low));
  const resolved = resolveWorkingLevel(support, localLow, last.close, tol, mode);
  const workingLevel = resolved.level;
  const near = resolved.near || isNearLevel(last.low, workingLevel, tol);
  const dipSpan =
    Math.max(...prior.map((c) => c.high), last.high) - Math.min(...prior.map((c) => c.low), last.low);
  const hadPullbackDown =
    prior.some(isBearishCandle) &&
    dipSpan >= atr * MIN_BOUNCE_ATR &&
    (localLow <= (prior[0]?.close ?? last.close) - atr * 0.1);

  const distance = Math.abs(last.close - workingLevel);

  if (!hadPullbackDown) {
    return withMeta(
      waitingBuy(
        mode === "RANGE"
          ? "Q3 PULLBACK=NO — RANGE near S, belum ada dip M1 ke support."
          : "Q3 PULLBACK=NO — M5 bullish, nunggu dip M1 ke support. Jangan chase rally.",
        0,
        workingLevel,
      ),
      workingLevel,
      distance,
      near,
      "SCAN",
    );
  }

  if (!near) {
    return withMeta(
      waitingBuy(
        `Q6 ENTRY_DISTANCE — harga ${last.close.toFixed(2)} masih jauh dari level ${workingLevel.toFixed(2)} (tol ${tol.toFixed(2)}). WAIT.`,
        Math.min(0.55, dipSpan / Math.max(atr * 2, dipSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "PULLBACK",
    );
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectBottom =
    isBullishCandle(last) &&
    (lowerWick(last) >= barRange * 0.12 ||
      last.close >= rangeMid(last) ||
      bodySize(last) >= atr * 0.1 ||
      (support != null && last.close > support));

  if (!rejectBottom) {
    return withMeta(
      {
        pullback: {
          detected: true,
          depth: Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
          nearLevel: workingLevel,
          notes: ["Q3 PULLBACK=YES — dip ke support / dasar lokal."],
        },
        rejection: {
          detected: false,
          side: null,
          atPrice: null,
          notes: ["Q4 REJECTION=NO — seller belum gagal jelas di level."],
        },
        momentum: {
          alignedWithTrend: false,
          direction: "unknown",
          strength: 0,
          notes: ["Q5 MOMENTUM — nunggu rejection dulu."],
        },
      },
      workingLevel,
      distance,
      near,
      "PULLBACK",
    );
  }

  const mom = detectMomentum(candles as Candle[], "bullish");
  const momOk =
    (mom.direction === "bullish" && (mom.alignedWithTrend || mom.strength >= 0.4)) ||
    (isBullishCandle(last) && rejectBottom && bodySize(last) >= atr * 0.08 && prior.some(isBearishCandle));

  if (!momOk) {
    return withMeta(
      {
        pullback: {
          detected: true,
          depth: Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
          nearLevel: workingLevel,
          notes: ["Q3 PULLBACK=YES — dip selesai dekat support."],
        },
        rejection: {
          detected: true,
          side: "bullish",
          atPrice: last.low,
          notes: ["Q4 REJECTION=YES — seller gagal di support / dasar."],
        },
        momentum: {
          alignedWithTrend: false,
          direction: mom.direction,
          strength: mom.strength,
          notes: ["Q5 MOMENTUM=NO — tekanan bullish belum kembali. WAIT."],
        },
      },
      workingLevel,
      distance,
      near,
      "REJECTION",
    );
  }

  if (last.close - workingLevel > Math.max(atr * 0.85, tol * 1.2)) {
    return withMeta(
      waitingBuy(
        `Q6/Q7 CHASE — reject sudah lewat, close ${last.close.toFixed(2)} jauh di atas level ${workingLevel.toFixed(2)}. WAIT.`,
        Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "WAIT",
    );
  }

  return withMeta(
    {
      pullback: {
        detected: true,
        depth: Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
        nearLevel: workingLevel,
        notes: ["Q3 PULLBACK=YES — dip ke support."],
      },
      rejection: {
        detected: true,
        side: "bullish",
        atPrice: last.low,
        notes: ["Q4 REJECTION=YES — gagal breakdown."],
      },
      momentum: {
        alignedWithTrend: true,
        direction: "bullish",
        strength: mom.strength,
        notes: mom.notes,
      },
    },
    workingLevel,
    distance,
    near,
    "READY",
  );
}

function withMeta(
  base: {
    pullback: PullbackAnalysis;
    rejection: RejectionAnalysis;
    momentum: MomentumAnalysis;
  },
  workingLevel: number | null,
  entryDistance: number | null,
  nearLevel: boolean,
  m1State: SequencedSetup["m1State"],
): SequencedSetup {
  return { ...base, workingLevel, entryDistance, nearLevel, m1State };
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
    workingLevel: null,
    entryDistance: null,
    nearLevel: false,
    m1State: "WAIT",
  };
}

function waitingBuy(note: string, depth = 0, near: number | null = null): {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
} {
  return {
    pullback: { detected: false, depth, nearLevel: near, notes: [note] },
    rejection: {
      detected: false,
      side: null,
      atPrice: null,
      notes: ["Need bullish rejection at support (BUY dasar)."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Waiting for local bottom / support bounce."],
    },
  };
}

function waitingSell(note: string, depth = 0, near: number | null = null): {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
} {
  return {
    pullback: { detected: false, depth, nearLevel: near, notes: [note] },
    rejection: {
      detected: false,
      side: null,
      atPrice: null,
      notes: ["Need bearish rejection at resistance (SELL pucuk)."],
    },
    momentum: {
      alignedWithTrend: false,
      direction: "unknown",
      strength: 0,
      notes: ["Waiting for local top / resistance reject."],
    },
  };
}
