/**
 * Deterministic decision cases: BUY, SELL, WAIT.
 * Run: npx tsx lib/trading-ai/tests/decision-cases.ts
 */

import { analyzeTrend } from "../brain/trend-analyzer";
import { decideTradingAction } from "../decide";
import { DEFAULT_TRADING_AI_CONFIG, HARD_RULES, mergeTradingAiConfig } from "../config";
import type { Candle, MarketSnapshot } from "../types";

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000 + i * 60, open: o, high: h, low: l, close: c };
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

function buildBullishM5(): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 60; i++) {
    const wave = Math.sin(i / 4) * 1.2;
    const mid = 2300 + i * 0.15 + wave;
    const bull = i % 5 !== 4;
    const o = mid;
    const c = mid + (bull ? 0.6 : -0.35);
    out.push(candle(i, o, Math.max(o, c) + 0.4, Math.min(o, c) - 0.4, c));
  }
  const n = out.length;
  out[n - 12] = candle(n - 12, 2308, 2310, 2307.5, 2309.2);
  out[n - 9] = candle(n - 9, 2309, 2309.5, 2306.8, 2307.2);
  out[n - 6] = candle(n - 6, 2307.5, 2312, 2307.2, 2311.5);
  out[n - 3] = candle(n - 3, 2311, 2311.4, 2308.5, 2309);
  out[n - 1] = candle(n - 1, 2309.2, 2313, 2309, 2312.5);
  return out;
}

function invertSeries(src: Candle[]): Candle[] {
  // Geometric invert so HH/HL → LL/LH and bullish M1 sequence → bearish sequence.
  return src.map((x) => ({
    time: x.time,
    open: 5000 - x.open,
    close: 5000 - x.close,
    high: 5000 - x.low,
    low: 5000 - x.high,
    volume: x.volume,
  }));
}

function buildBearishM5(): Candle[] {
  return invertSeries(buildBullishM5());
}

function buildBullishM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2308;
  for (let i = 0; i < 16; i++) {
    const o = px;
    const c = px + 0.5;
    out.push(candle(i, o, c + 0.2, o - 0.1, c));
    px = c;
  }
  while (px > 2308.6) {
    const o = px;
    const c = px - 0.45;
    out.push(candle(out.length, o, Math.max(o, c) + 0.08, Math.min(o, c) - 0.08, c));
    px = c;
  }
  out.push(candle(out.length, 2308.4, 2308.7, 2307.8, 2308.55));
  px = 2308.55;
  for (let i = 0; i < 6; i++) {
    const o = px;
    const c = px + 0.45;
    out.push(candle(out.length, o, c + 0.15, o - 0.05, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.1, px - 0.05, px + 0.05));
  return out;
}

function buildBearishM1(): Candle[] {
  return invertSeries(buildBullishM1());
}

// --- WAIT: thin data ---
{
  const r = decideTradingAction({
    symbol: "XAUUSD",
    m5Candles: buildBullishM5().slice(0, 5),
    m1Candles: buildBullishM1().slice(0, 5),
    market: market(2300),
    openPositions: [],
  });
  assert(r.decision === "WAIT", `WAIT case failed: ${r.decision}`);
  assert(r.executable === false, "WAIT must not be executable");
  assert(r.audit.m5Trend === "unknown" || r.audit.decision === "WAIT", "audit WAIT");
  assert(HARD_RULES.MAX_POSITION === 1 && HARD_RULES.NO_HEDGE === true, "hard rules");
  console.log("PASS WAIT", r.decision, "conf=", r.confidence, "trend=", r.trend.direction);
}

// --- BUY ---
{
  const m5 = buildBullishM5();
  const m1 = buildBullishM1();
  const trend = analyzeTrend(m5, config);
  assert(trend.direction === "bullish", `expected bullish M5, got ${trend.direction}`);
  const r = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1[m1.length - 1].close),
      openPositions: [],
    },
    { config },
  );
  assert(r.decision === "BUY", `BUY case failed: ${r.decision} conf=${r.confidence} reasons=${r.reasons.join(" | ")}`);
  assert(r.audit.decision === "BUY", "audit decision BUY");
  assert(r.pullback.detected && r.rejection.detected && r.momentum.alignedWithTrend, "setup");
  assert(r.validation.breakdown.features.some((f) => f.id === "m5_bias_clear" && f.passed), "feature audit");
  console.log("PASS BUY", r.decision, "conf=", r.confidence);
}

// --- SELL ---
{
  const m5 = buildBearishM5();
  const m1 = buildBearishM1();
  const trend = analyzeTrend(m5, config);
  assert(trend.direction === "bearish", `expected bearish M5, got ${trend.direction}`);
  const r = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1[m1.length - 1].close),
      openPositions: [],
    },
    { config },
  );
  assert(r.decision === "SELL", `SELL case failed: ${r.decision} conf=${r.confidence} reasons=${r.reasons.join(" | ")}`);
  assert(r.audit.decision === "SELL", "audit decision SELL");
  console.log("PASS SELL", r.decision, "conf=", r.confidence);
}

console.log("decision-cases ok");
console.log("HARD_RULES", {
  MAX_POSITION: HARD_RULES.MAX_POSITION,
  NO_AVERAGING: HARD_RULES.NO_AVERAGING,
  NO_MARTINGALE: HARD_RULES.NO_MARTINGALE,
  NO_GRID: HARD_RULES.NO_GRID,
  NO_HEDGE: HARD_RULES.NO_HEDGE,
});
