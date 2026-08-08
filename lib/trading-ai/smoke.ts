/**
 * Smoke checks for Trading AI Brain (no broker).
 * Run: npx tsx lib/trading-ai/smoke.ts
 */

import { analyzeTrend } from "./brain/trend-analyzer";
import { detectSequencedSetup } from "./brain/setup-sequence";
import { decideTradingAction } from "./decide";
import { DEFAULT_TRADING_AI_CONFIG, mergeTradingAiConfig } from "./config";
import type { Candle, MarketSnapshot } from "./types";

function candle(
  i: number,
  o: number,
  h: number,
  l: number,
  c: number,
): Candle {
  return { time: 1_700_000_000 + i * 60, open: o, high: h, low: l, close: c };
}

/** Build HH/HL M5 structure. */
function buildBullishM5(): Candle[] {
  const out: Candle[] = [];
  let base = 2300;
  for (let i = 0; i < 60; i++) {
    // gentle uptrend with swings
    const wave = Math.sin(i / 4) * 1.2;
    const drift = i * 0.15;
    const mid = base + drift + wave;
    const bull = i % 5 !== 4;
    const o = mid;
    const c = mid + (bull ? 0.6 : -0.35);
    const h = Math.max(o, c) + 0.4;
    const l = Math.min(o, c) - 0.4;
    out.push(candle(i, o, h, l, c));
  }
  // Force clearer HH HL at the end
  const n = out.length;
  out[n - 12] = candle(n - 12, 2308, 2310, 2307.5, 2309.2);
  out[n - 9] = candle(n - 9, 2309, 2309.5, 2306.8, 2307.2); // HL vs earlier
  out[n - 6] = candle(n - 6, 2307.5, 2312, 2307.2, 2311.5); // HH
  out[n - 3] = candle(n - 3, 2311, 2311.4, 2308.5, 2309); // higher low area
  out[n - 1] = candle(n - 1, 2309.2, 2313, 2309, 2312.5);
  return out;
}

/** M1: pullback to support (~2308), rejection wick, then bullish momentum. */
function buildBullishM1Setup(): Candle[] {
  const out: Candle[] = [];
  let px = 2308;
  // impulse up to ~2316
  for (let i = 0; i < 16; i++) {
    const o = px;
    const c = px + 0.5;
    out.push(candle(i, o, c + 0.2, o - 0.1, c));
    px = c;
  }
  // pullback down toward support
  while (px > 2308.6) {
    const o = px;
    const c = px - 0.45;
    const low = Math.min(o, c) - 0.08;
    const high = Math.max(o, c) + 0.08;
    out.push(candle(out.length, o, high, low, c));
    px = c;
  }
  // clear bullish rejection pin at support
  out.push(candle(out.length, 2308.4, 2308.7, 2307.8, 2308.55));
  px = 2308.55;
  // momentum up
  for (let i = 0; i < 6; i++) {
    const o = px;
    const c = px + 0.45;
    out.push(candle(out.length, o, c + 0.15, o - 0.05, c));
    px = c;
  }
  // forming bar
  out.push(candle(out.length, px, px + 0.1, px - 0.05, px + 0.05));
  return out;
}

function market(bid: number): MarketSnapshot {
  return { symbol: "XAUUSD", bid, ask: bid + 0.2, spread: 20, at: Date.now() };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const config = mergeTradingAiConfig({
  ...DEFAULT_TRADING_AI_CONFIG,
  brain: {
    ...DEFAULT_TRADING_AI_CONFIG.brain,
    minM5Candles: 40,
    minM1Candles: 25,
    minConfidenceToEnter: 50,
    pullbackMinDepth: 0.15,
    pullbackMaxDepth: 0.95,
    levelTouchAtrMult: 1.2,
  },
});

const m5 = buildBullishM5();
const m1 = buildBullishM1Setup();
const trend = analyzeTrend(m5, config);
console.log("trend:", trend.direction, trend.strength, trend.notes[0]);

const sr = {
  timeframe: "M5" as const,
  levels: [],
  nearestSupport: 2308.1,
  nearestResistance: 2314,
};
const setup = detectSequencedSetup(m1, "bullish", config, sr);
console.log("pullback:", setup.pullback.detected, setup.pullback.notes[0]);
console.log("rejection:", setup.rejection.detected, setup.rejection.notes[0]);
console.log("momentum:", setup.momentum.alignedWithTrend, setup.momentum.notes[0]);

const result = decideTradingAction(
  {
    symbol: "XAUUSD",
    m5Candles: m5,
    m1Candles: m1,
    market: market(m1[m1.length - 1].close),
    openPositions: [],
  },
  { config },
);

console.log("decision:", result.decision, "confidence:", result.confidence);
console.log("executable:", result.executable);
console.log("reasons:", result.reasons.slice(0, 4));

assert(result.executable === false, "must never be executable");
assert(result.decision === "BUY", `expected BUY on synthetic setup, got ${result.decision} conf=${result.confidence}`);
assert(result.entry.suggestedStopLoss != null, "BUY should suggest SL");
assert(result.entry.suggestedLot === config.risk.defaultLot, "default lot");

// Empty / insufficient → WAIT
const waitResult = decideTradingAction({
  symbol: "XAUUSD",
  m5Candles: m5.slice(0, 5),
  m1Candles: m1.slice(0, 5),
  market: market(2300),
  openPositions: [],
});
assert(waitResult.decision === "WAIT", "thin data must WAIT");
assert(waitResult.executable === false, "WAIT must not execute");

// Max 1 position: with open BUY, no second entry
const blocked = decideTradingAction(
  {
    symbol: "XAUUSD",
    m5Candles: m5,
    m1Candles: m1,
    market: market(m1[m1.length - 1].close),
    openPositions: [
      {
        id: "p1",
        symbol: "XAUUSD",
        side: "BUY",
        lot: 0.01,
        openPrice: 2310,
        stopLoss: 2307,
        takeProfit: 2315,
        openedAt: Date.now(),
        floatingPnl: 0,
      },
    ],
  },
  { config },
);
assert(
  blocked.decision === "WAIT" || blocked.decision === "CLOSE",
  "open position must block new entry",
);
assert(blocked.exit.decision === "HOLD" || blocked.exit.decision === "CLOSE", "exit is HOLD|CLOSE");
assert(blocked.audit != null && blocked.audit.decision === blocked.decision, "audit attached");
assert(Array.isArray(blocked.validation.breakdown.features), "confidence features present");

console.log("smoke ok");
