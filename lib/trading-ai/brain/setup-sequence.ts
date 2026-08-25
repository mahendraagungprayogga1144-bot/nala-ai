/**
 * Sequenced M1 — Hybrid S/R + M5 bias:
 * M5 = bias/context, S/R = location, M1 = timing (PULLBACK → REJECTION → MOMENTUM).
 *
 * TRENDING_BULLISH: near S → BUY; middle → WAIT; near R → SELL counter (strict) or WAIT.
 * TRENDING_BEARISH: near R → SELL; middle → WAIT; near S → BUY counter (strict) or WAIT.
 * RANGE: near R → SELL; near S → BUY; middle → WAIT.
 * Never fade strong breakout / breakdown continuation.
 */

import type { TradingAiConfig } from "../config";
import type {
  Candle,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SetupKind,
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
  type RangeZone,
} from "./support-resistance";

export type SequencedSetup = {
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  /** Working entry level (S/R preferred). */
  workingLevel: number | null;
  entryDistance: number | null;
  nearLevel: boolean;
  m1State: "SCAN" | "PULLBACK" | "REJECTION" | "MOMENTUM" | "READY" | "WAIT";
  setupKind: SetupKind;
  zone: RangeZone | "unknown";
  /** Strong rejection (required for COUNTER). */
  strongRejection: boolean;
  /** True when tape is continuing through the level — do not fade. */
  breakoutContinuation: boolean;
};

const BOUNCE_BARS = 5;
const MIN_BOUNCE_ATR = 0.18;
/** Max chase distance past working level (price units). */
const MAX_ENTRY_DISTANCE = 0.85;

type CandleLike = Candle;
type ChainMode = "WITH_TREND" | "COUNTER" | "RANGE";

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
  const zone = classifyRangeZone(last.close, support, resistance, tol);

  if (zone === "incomplete") {
    return emptySetup("S/R incomplete — WAIT until support/resistance clear.", zone);
  }

  if (zone === "middle") {
    return emptySetup(
      "MIDDLE range — WAIT. Hanya near support (BUY) / near resistance (SELL).",
      zone,
    );
  }

  // --- RANGE ---
  if (trendDirection === "sideways") {
    if (zone === "near_resistance" || (zone === "outside" && resistance != null && last.close >= resistance)) {
      if (isStrongBreakoutUp(m1Candles, closed, resistance, atr, tol)) {
        return emptySetup(
          "RANGE breakout bullish kuat di resistance — jangan fade. WAIT struktur baru.",
          zone,
          true,
        );
      }
      return finalize(
        sellChain(m1Candles, closed, config, resistance, atr, tol, "RANGE"),
        m1Candles,
        closed,
        "RANGE",
        zone,
      );
    }
    if (zone === "near_support" || (zone === "outside" && support != null && last.close <= support)) {
      if (isStrongBreakdown(m1Candles, closed, support, atr, tol)) {
        return emptySetup(
          "RANGE breakdown bearish kuat di support — jangan fade. WAIT struktur baru.",
          zone,
          true,
        );
      }
      return finalize(
        buyChain(m1Candles, closed, config, support, atr, tol, "RANGE"),
        m1Candles,
        closed,
        "RANGE",
        zone,
      );
    }
    return emptySetup("RANGE zone unclear — WAIT.", zone);
  }

  // --- TRENDING BULLISH (hybrid) ---
  if (trendDirection === "bullish") {
    if (zone === "near_support" || (zone === "outside" && support != null && last.close < support)) {
      if (isStrongBreakdown(m1Candles, closed, support, atr, tol)) {
        return emptySetup(
          "M5 bullish tapi breakdown kuat di support — jangan BUY jatuh. WAIT.",
          zone,
          true,
        );
      }
      return finalize(
        buyChain(m1Candles, closed, config, support, atr, tol, "WITH_TREND"),
        m1Candles,
        closed,
        "WITH_TREND",
        zone,
      );
    }
    if (zone === "near_resistance" || (zone === "outside" && resistance != null && last.close > resistance)) {
      if (isStrongBreakoutUp(m1Candles, closed, resistance, atr, tol)) {
        return emptySetup(
          "M5 bullish + breakout kuat di resistance — BLOCK BUY, jangan SELL fade. WAIT.",
          zone,
          true,
        );
      }
      // Counter SELL only with strict chain + strong rejection later.
      return finalize(
        sellChain(m1Candles, closed, config, resistance, atr, tol, "COUNTER"),
        m1Candles,
        closed,
        "COUNTER",
        zone,
      );
    }
    return emptySetup("M5 bullish — zona tidak di S/R. WAIT.", zone);
  }

  // --- TRENDING BEARISH (hybrid) ---
  if (zone === "near_resistance" || (zone === "outside" && resistance != null && last.close > resistance)) {
    if (isStrongBreakoutUp(m1Candles, closed, resistance, atr, tol)) {
      return emptySetup(
        "M5 bearish tapi breakout kuat di resistance — jangan SELL rally. WAIT.",
        zone,
        true,
      );
    }
    return finalize(
      sellChain(m1Candles, closed, config, resistance, atr, tol, "WITH_TREND"),
      m1Candles,
      closed,
      "WITH_TREND",
      zone,
    );
  }
  if (zone === "near_support" || (zone === "outside" && support != null && last.close < support)) {
    if (isStrongBreakdown(m1Candles, closed, support, atr, tol)) {
      return emptySetup(
        "M5 bearish + breakdown kuat di support — BLOCK SELL, jangan BUY fade. WAIT.",
        zone,
        true,
      );
    }
    return finalize(
      buyChain(m1Candles, closed, config, support, atr, tol, "COUNTER"),
      m1Candles,
      closed,
      "COUNTER",
      zone,
    );
  }
  return emptySetup("M5 bearish — zona tidak di S/R. WAIT.", zone);
}

function finalize(
  setup: SequencedSetup,
  candles: CandleLike[],
  closed: number,
  kind: SetupKind,
  zone: RangeZone,
): SequencedSetup {
  const vetoed = vetoFadeBreakout(setup, candles, closed);
  const strongRejection = measureStrongRejection(vetoed, candles, closed);
  let next: SequencedSetup = {
    ...vetoed,
    setupKind: kind,
    zone,
    strongRejection,
    breakoutContinuation: vetoed.breakoutContinuation,
  };

  // Counter must have strong rejection + ready momentum; otherwise demote to WAIT.
  if (
    kind === "COUNTER" &&
    next.pullback.detected &&
    next.rejection.detected &&
    next.m1State === "READY" &&
    !strongRejection
  ) {
    next = {
      ...withMeta(
        next.rejection.side === "bearish"
          ? waitingSell(
              "COUNTER — rejection belum kuat di resistance. WAIT.",
              next.pullback.depth,
              next.workingLevel,
            )
          : waitingBuy(
              "COUNTER — rejection belum kuat di support. WAIT.",
              next.pullback.depth,
              next.workingLevel,
            ),
        next.workingLevel,
        next.entryDistance,
        next.nearLevel,
        "REJECTION",
        kind,
        zone,
        false,
        false,
      ),
    };
  }

  return next;
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
          "M1 lagi naik / breakout continuation — jangan SELL fade. WAIT.",
          setup.pullback.depth,
          last.high,
        ),
        setup.workingLevel,
        setup.entryDistance,
        false,
        "WAIT",
        setup.setupKind,
        setup.zone,
        false,
        true,
      ),
    };
  }
  if (setup.rejection.side === "bullish" && falling && isBearishCandle(last)) {
    return {
      ...withMeta(
        waitingBuy(
          "M1 masih breakdown continuation — jangan BUY fade. WAIT.",
          setup.pullback.depth,
          last.low,
        ),
        setup.workingLevel,
        setup.entryDistance,
        false,
        "WAIT",
        setup.setupKind,
        setup.zone,
        false,
        true,
      ),
    };
  }
  return setup;
}

function isStrongBreakoutUp(
  candles: CandleLike[],
  closed: number,
  resistance: number | null,
  atr: number,
  tol: number,
): boolean {
  if (resistance == null) return false;
  const last = candles[closed];
  if (!isBullishCandle(last)) return false;
  const body = bodySize(last);
  const closesThrough = last.close > resistance + Math.max(tol * 0.35, atr * 0.08);
  const rising = isRisingTape(candles, closed);
  const mom = detectMomentum(candles as Candle[], "bullish");
  return (
    closesThrough &&
    body >= atr * 0.18 &&
    (rising || (mom.direction === "bullish" && mom.strength >= 0.55))
  );
}

function isStrongBreakdown(
  candles: CandleLike[],
  closed: number,
  support: number | null,
  atr: number,
  tol: number,
): boolean {
  if (support == null) return false;
  const last = candles[closed];
  if (!isBearishCandle(last)) return false;
  const body = bodySize(last);
  const closesThrough = last.close < support - Math.max(tol * 0.35, atr * 0.08);
  const falling = isFallingTape(candles, closed);
  const mom = detectMomentum(candles as Candle[], "bearish");
  return (
    closesThrough &&
    body >= atr * 0.18 &&
    (falling || (mom.direction === "bearish" && mom.strength >= 0.55))
  );
}

function measureStrongRejection(
  setup: SequencedSetup,
  candles: CandleLike[],
  closed: number,
): boolean {
  if (!setup.rejection.detected) return false;
  const last = candles[closed];
  const barRange = Math.max(last.high - last.low, 1e-9);
  const atr = atrApprox(candles) || last.close * 0.001;
  if (setup.rejection.side === "bearish") {
    const wickOk = upperWick(last) >= barRange * 0.28;
    const closeBack =
      last.close <= rangeMid(last) &&
      (setup.workingLevel == null || last.close <= setup.workingLevel + atr * 0.05);
    const bodyOk = isBearishCandle(last) && bodySize(last) >= atr * 0.1;
    return wickOk && closeBack && bodyOk;
  }
  if (setup.rejection.side === "bullish") {
    const wickOk = lowerWick(last) >= barRange * 0.28;
    const closeBack =
      last.close >= rangeMid(last) &&
      (setup.workingLevel == null || last.close >= setup.workingLevel - atr * 0.05);
    const bodyOk = isBullishCandle(last) && bodySize(last) >= atr * 0.1;
    return wickOk && closeBack && bodyOk;
  }
  return false;
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

/**
 * Hybrid: working level is S/R only (no loose local-extreme middle entries).
 * Local extreme only confirms touch when already near S/R.
 */
function resolveWorkingLevel(
  srLevel: number | null,
  localExtreme: number,
  price: number,
  tol: number,
): { level: number | null; near: boolean } {
  if (srLevel == null) return { level: null, near: false };
  const nearSr =
    isNearLevel(price, srLevel, tol) ||
    isNearLevel(localExtreme, srLevel, tol) ||
    Math.abs(price - srLevel) <= tol;
  return { level: srLevel, near: nearSr };
}

function sellChain(
  candles: CandleLike[],
  closed: number,
  config: TradingAiConfig,
  resistance: number | null,
  atr: number,
  tol: number,
  mode: ChainMode,
): SequencedSetup {
  const kind: SetupKind = mode;
  const zone: RangeZone | "unknown" = "unknown";
  const last = candles[closed];
  const winFrom = Math.max(0, closed - BOUNCE_BARS);
  const win = candles.slice(winFrom, closed + 1);
  const prior = win.slice(0, -1);
  const localHigh = Math.max(...win.map((c) => c.high));
  const resolved = resolveWorkingLevel(resistance, localHigh, last.close, tol);
  const workingLevel = resolved.level;
  const near =
    resolved.near ||
    (workingLevel != null && isNearLevel(last.high, workingLevel, tol));
  const bounceSpan =
    Math.max(...prior.map((c) => c.high), last.high) -
    Math.min(...prior.map((c) => c.low), last.low);
  const hadPullbackUp =
    prior.some(isBullishCandle) &&
    bounceSpan >= atr * MIN_BOUNCE_ATR &&
    localHigh >= (prior[0]?.close ?? last.close) + atr * 0.1;

  const distance = workingLevel != null ? Math.abs(last.close - workingLevel) : null;

  if (workingLevel == null) {
    return withMeta(
      waitingSell("No resistance level — WAIT.", 0, null),
      null,
      null,
      false,
      "WAIT",
      kind,
      zone,
      false,
      false,
    );
  }

  if (!hadPullbackUp) {
    return withMeta(
      waitingSell(
        mode === "COUNTER"
          ? "Q3 PULLBACK=NO — COUNTER di R, belum bounce M1. WAIT."
          : mode === "RANGE"
            ? "Q3 PULLBACK=NO — RANGE near R, belum bounce M1 ke resistance."
            : "Q3 PULLBACK=NO — M5 bearish, nunggu bounce M1 ke resistance.",
        0,
        workingLevel,
      ),
      workingLevel,
      distance,
      near,
      "SCAN",
      kind,
      zone,
      false,
      false,
    );
  }

  if (!near || (distance != null && distance > MAX_ENTRY_DISTANCE && distance > tol)) {
    return withMeta(
      waitingSell(
        `Q6 ENTRY_DISTANCE — harga ${last.close.toFixed(2)} jauh dari R ${workingLevel.toFixed(2)} (tol ${tol.toFixed(2)}). WAIT.`,
        Math.min(0.55, bounceSpan / Math.max(atr * 2, bounceSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "PULLBACK",
      kind,
      zone,
      false,
      false,
    );
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectTopBasic =
    isBearishCandle(last) &&
    (upperWick(last) >= barRange * 0.12 ||
      last.close <= rangeMid(last) ||
      bodySize(last) >= atr * 0.1 ||
      last.close < workingLevel);

  // Counter needs stronger rejection signal at detection stage.
  const rejectTop =
    mode === "COUNTER"
      ? rejectTopBasic &&
        upperWick(last) >= barRange * 0.22 &&
        last.close <= rangeMid(last) &&
        isBearishCandle(last)
      : rejectTopBasic;

  if (!rejectTop) {
    return withMeta(
      {
        pullback: {
          detected: true,
          depth: Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
          nearLevel: workingLevel,
          notes: ["Q3 PULLBACK=YES — bounce ke resistance."],
        },
        rejection: {
          detected: false,
          side: null,
          atPrice: null,
          notes: [
            mode === "COUNTER"
              ? "Q4 REJECTION=NO — COUNTER butuh rejection kuat di R."
              : "Q4 REJECTION=NO — buyer belum gagal jelas di resistance.",
          ],
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
      kind,
      zone,
      false,
      false,
    );
  }

  const mom = detectMomentum(candles as Candle[], "bearish");
  const momOk =
    mode === "COUNTER"
      ? mom.direction === "bearish" && mom.strength >= 0.5
      : (mom.direction === "bearish" && (mom.alignedWithTrend || mom.strength >= 0.4)) ||
        (isBearishCandle(last) &&
          rejectTop &&
          bodySize(last) >= atr * 0.08 &&
          prior.some(isBullishCandle));

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
          notes: ["Q4 REJECTION=YES — buyer gagal di resistance."],
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
      kind,
      zone,
      mode === "COUNTER",
      false,
    );
  }

  if (workingLevel - last.close > Math.max(atr * 0.85, tol * 1.2, MAX_ENTRY_DISTANCE)) {
    return withMeta(
      waitingSell(
        `Q6/Q7 CHASE — reject sudah lewat, close ${last.close.toFixed(2)} jauh di bawah R ${workingLevel.toFixed(2)}. WAIT.`,
        Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "WAIT",
      kind,
      zone,
      false,
      false,
    );
  }

  return withMeta(
    {
      pullback: {
        detected: true,
        depth: Math.min(0.55, bounceSpan / Math.max(atr * 2.2, bounceSpan)),
        nearLevel: workingLevel,
        notes: [
          mode === "COUNTER"
            ? "Q3 PULLBACK=YES — COUNTER bounce ke resistance."
            : "Q3 PULLBACK=YES — bounce ke resistance.",
        ],
      },
      rejection: {
        detected: true,
        side: "bearish",
        atPrice: last.high,
        notes: [
          mode === "COUNTER"
            ? "Q4 REJECTION=YES — failed break / gagal lanjut di R (counter)."
            : "Q4 REJECTION=YES — gagal tembus atas.",
        ],
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
    kind,
    zone,
    mode === "COUNTER",
    false,
  );
}

function buyChain(
  candles: CandleLike[],
  closed: number,
  config: TradingAiConfig,
  support: number | null,
  atr: number,
  tol: number,
  mode: ChainMode,
): SequencedSetup {
  const kind: SetupKind = mode;
  const zone: RangeZone | "unknown" = "unknown";
  const last = candles[closed];
  const winFrom = Math.max(0, closed - BOUNCE_BARS);
  const win = candles.slice(winFrom, closed + 1);
  const prior = win.slice(0, -1);
  const localLow = Math.min(...win.map((c) => c.low));
  const resolved = resolveWorkingLevel(support, localLow, last.close, tol);
  const workingLevel = resolved.level;
  const near =
    resolved.near ||
    (workingLevel != null && isNearLevel(last.low, workingLevel, tol));
  const dipSpan =
    Math.max(...prior.map((c) => c.high), last.high) -
    Math.min(...prior.map((c) => c.low), last.low);
  const hadPullbackDown =
    prior.some(isBearishCandle) &&
    dipSpan >= atr * MIN_BOUNCE_ATR &&
    localLow <= (prior[0]?.close ?? last.close) - atr * 0.1;

  const distance = workingLevel != null ? Math.abs(last.close - workingLevel) : null;

  if (workingLevel == null) {
    return withMeta(
      waitingBuy("No support level — WAIT.", 0, null),
      null,
      null,
      false,
      "WAIT",
      kind,
      zone,
      false,
      false,
    );
  }

  if (!hadPullbackDown) {
    return withMeta(
      waitingBuy(
        mode === "COUNTER"
          ? "Q3 PULLBACK=NO — COUNTER di S, belum dip M1. WAIT."
          : mode === "RANGE"
            ? "Q3 PULLBACK=NO — RANGE near S, belum dip M1 ke support."
            : "Q3 PULLBACK=NO — M5 bullish, nunggu dip M1 ke support.",
        0,
        workingLevel,
      ),
      workingLevel,
      distance,
      near,
      "SCAN",
      kind,
      zone,
      false,
      false,
    );
  }

  if (!near || (distance != null && distance > MAX_ENTRY_DISTANCE && distance > tol)) {
    return withMeta(
      waitingBuy(
        `Q6 ENTRY_DISTANCE — harga ${last.close.toFixed(2)} jauh dari S ${workingLevel.toFixed(2)} (tol ${tol.toFixed(2)}). WAIT.`,
        Math.min(0.55, dipSpan / Math.max(atr * 2, dipSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "PULLBACK",
      kind,
      zone,
      false,
      false,
    );
  }

  const barRange = Math.max(last.high - last.low, 1e-9);
  const rejectBottomBasic =
    isBullishCandle(last) &&
    (lowerWick(last) >= barRange * 0.12 ||
      last.close >= rangeMid(last) ||
      bodySize(last) >= atr * 0.1 ||
      last.close > workingLevel);

  const rejectBottom =
    mode === "COUNTER"
      ? rejectBottomBasic &&
        lowerWick(last) >= barRange * 0.22 &&
        last.close >= rangeMid(last) &&
        isBullishCandle(last)
      : rejectBottomBasic;

  if (!rejectBottom) {
    return withMeta(
      {
        pullback: {
          detected: true,
          depth: Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
          nearLevel: workingLevel,
          notes: ["Q3 PULLBACK=YES — dip ke support."],
        },
        rejection: {
          detected: false,
          side: null,
          atPrice: null,
          notes: [
            mode === "COUNTER"
              ? "Q4 REJECTION=NO — COUNTER butuh rejection kuat di S."
              : "Q4 REJECTION=NO — seller belum gagal jelas di support.",
          ],
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
      kind,
      zone,
      false,
      false,
    );
  }

  const mom = detectMomentum(candles as Candle[], "bullish");
  const momOk =
    mode === "COUNTER"
      ? mom.direction === "bullish" && mom.strength >= 0.5
      : (mom.direction === "bullish" && (mom.alignedWithTrend || mom.strength >= 0.4)) ||
        (isBullishCandle(last) &&
          rejectBottom &&
          bodySize(last) >= atr * 0.08 &&
          prior.some(isBearishCandle));

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
          notes: ["Q4 REJECTION=YES — seller gagal di support."],
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
      kind,
      zone,
      mode === "COUNTER",
      false,
    );
  }

  if (last.close - workingLevel > Math.max(atr * 0.85, tol * 1.2, MAX_ENTRY_DISTANCE)) {
    return withMeta(
      waitingBuy(
        `Q6/Q7 CHASE — reject sudah lewat, close ${last.close.toFixed(2)} jauh di atas S ${workingLevel.toFixed(2)}. WAIT.`,
        Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
        workingLevel,
      ),
      workingLevel,
      distance,
      false,
      "WAIT",
      kind,
      zone,
      false,
      false,
    );
  }

  return withMeta(
    {
      pullback: {
        detected: true,
        depth: Math.min(0.55, dipSpan / Math.max(atr * 2.2, dipSpan)),
        nearLevel: workingLevel,
        notes: [
          mode === "COUNTER"
            ? "Q3 PULLBACK=YES — COUNTER dip ke support."
            : "Q3 PULLBACK=YES — dip ke support.",
        ],
      },
      rejection: {
        detected: true,
        side: "bullish",
        atPrice: last.low,
        notes: [
          mode === "COUNTER"
            ? "Q4 REJECTION=YES — failed breakdown / gagal lanjut di S (counter)."
            : "Q4 REJECTION=YES — gagal breakdown.",
        ],
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
    kind,
    zone,
    mode === "COUNTER",
    false,
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
  setupKind: SetupKind = "NONE",
  zone: RangeZone | "unknown" = "unknown",
  strongRejection = false,
  breakoutContinuation = false,
): SequencedSetup {
  return {
    ...base,
    workingLevel,
    entryDistance,
    nearLevel,
    m1State,
    setupKind,
    zone,
    strongRejection,
    breakoutContinuation,
  };
}

function emptySetup(
  note: string,
  zone: RangeZone | "unknown" = "unknown",
  breakoutContinuation = false,
): SequencedSetup {
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
    setupKind: "NONE",
    zone,
    strongRejection: false,
    breakoutContinuation,
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
