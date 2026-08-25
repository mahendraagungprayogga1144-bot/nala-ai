/**
 * Smoke checks for Trading AI Brain (no broker).
 * Hybrid S/R + M5 bias — Run: npx tsx lib/trading-ai/smoke.ts
 */

import { analyzeTrend } from "./brain/trend-analyzer";
import { decideEntry } from "./brain/entry-decision";
import { decideExit } from "./brain/exit-decision";
import { detectSequencedSetup } from "./brain/setup-sequence";
import { decideTradingAction } from "./decide";
import { evaluateExecutionGate } from "./execution-gate";
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
  const base = 2300;
  for (let i = 0; i < 60; i++) {
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
  const n = out.length;
  out[n - 12] = candle(n - 12, 2308, 2310, 2307.5, 2309.2);
  out[n - 9] = candle(n - 9, 2309, 2309.5, 2306.8, 2307.2);
  out[n - 6] = candle(n - 6, 2307.5, 2312, 2307.2, 2311.5);
  out[n - 3] = candle(n - 3, 2311, 2311.4, 2308.5, 2309);
  out[n - 1] = candle(n - 1, 2309.2, 2313, 2309, 2312.5);
  return out;
}

/** M1: dump lalu stall hijau di dasar. */
function buildBullishM1Setup(): Candle[] {
  const out: Candle[] = [];
  let px = 2315;
  for (let i = 0; i < 26; i++) {
    const o = px;
    const c = px - 0.45;
    out.push(candle(i, o, o + 0.08, c - 0.06, c));
    px = c;
  }
  for (let k = 0; k < 3; k++) {
    const o = px;
    const c = px + 0.14;
    out.push(candle(out.length, o, c + 0.04, o - 0.16, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.02, px - 0.02, px));
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
    pullbackMaxDepth: 0.55,
    pullbackDepthBasis: "impulse",
    levelTouchAtrMult: 1.2,
  },
});

const m5 = buildBullishM5();
const m1 = buildBullishM1Setup();
const trend = analyzeTrend(m5, config);
console.log("trend:", trend.direction, trend.strength, trend.notes[0]);

// Hybrid router: middle / far from S/R → WAIT (expected with old dump fixture).
const srFar = {
  timeframe: "M5" as const,
  levels: [],
  nearestSupport: 2308.1,
  nearestResistance: 2314,
};
const setupFar = detectSequencedSetup(m1, "bullish", config, srFar);
console.log("far-S pullback:", setupFar.pullback.detected, setupFar.pullback.notes[0]);
assert(
  setupFar.m1State === "WAIT" ||
    setupFar.m1State === "PULLBACK" ||
    setupFar.m1State === "SCAN" ||
    !setupFar.nearLevel,
  "far from support must not be READY",
);

// Hybrid happy path: near support + WITH_TREND chain via decideEntry
const unitBuy = decideEntry({
  trend: {
    timeframe: "M5",
    direction: "bullish",
    regime: "TRENDING_BULLISH",
    strength: 0.85,
    notes: [],
  },
  pullback: { detected: true, depth: 0.35, nearLevel: 2300, notes: ["dip"] },
  rejection: { detected: true, side: "bullish", atPrice: 2299.8, notes: ["reject"] },
  momentum: {
    alignedWithTrend: true,
    direction: "bullish",
    strength: 0.8,
    notes: ["mom"],
  },
  supportResistance: {
    timeframe: "M5",
    levels: [],
    nearestSupport: 2300,
    nearestResistance: 2310,
  },
  marketPrice: 2300.2,
  config,
  nearLevel: true,
  entryDistance: 0.2,
  setupKind: "WITH_TREND",
  strongRejection: true,
});
assert(unitBuy.decision === "BUY", `hybrid WITH_TREND BUY expected, got ${unitBuy.decision}`);
assert(unitBuy.suggestedStopLoss != null, "BUY should suggest SL");
assert(unitBuy.suggestedLot === config.risk.defaultLot, "default lot");
console.log("unit BUY:", unitBuy.decision, unitBuy.entryQuality, unitBuy.setupKind);

// Counter SELL at resistance while M5 bullish
const unitCounter = decideEntry({
  trend: {
    timeframe: "M5",
    direction: "bullish",
    regime: "TRENDING_BULLISH",
    strength: 0.8,
    notes: [],
  },
  pullback: { detected: true, depth: 0.35, nearLevel: 2310, notes: ["bounce"] },
  rejection: { detected: true, side: "bearish", atPrice: 2310.2, notes: ["reject"] },
  momentum: {
    alignedWithTrend: true,
    direction: "bearish",
    strength: 0.75,
    notes: ["mom"],
  },
  supportResistance: {
    timeframe: "M5",
    levels: [],
    nearestSupport: 2300,
    nearestResistance: 2310,
  },
  marketPrice: 2309.8,
  config,
  nearLevel: true,
  entryDistance: 0.2,
  setupKind: "COUNTER",
  strongRejection: true,
});
assert(unitCounter.decision === "SELL", `hybrid COUNTER SELL expected, got ${unitCounter.decision}`);
console.log("unit COUNTER SELL:", unitCounter.decision, unitCounter.setupKind);

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

console.log("pipeline decision:", result.decision, "confidence:", result.confidence);
console.log("executable:", result.executable, "accountMode:", result.execution.accountMode);
console.log("reasons:", result.reasons.slice(0, 4));

assert(result.executable === false, "default caller must not be executable");
assert(result.execution.accountMode === "unknown", "default account mode is unknown");
assert(
  result.decision === "WAIT" || result.decision === "BUY",
  `pipeline must WAIT|BUY on far-level fixture, got ${result.decision}`,
);

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

const waitDemo = decideTradingAction(
  {
    symbol: "XAUUSD",
    m5Candles: m5.slice(0, 5),
    m1Candles: m1.slice(0, 5),
    market: market(2300),
    openPositions: [],
  },
  { accountMode: "demo", executionEnabled: true },
);
assert(waitDemo.decision === "WAIT", "thin data must WAIT on demo too");
assert(waitDemo.executable === false, "WAIT must never be executable, even on demo");

// Execution gate: demo/real allow BUY; contest/unknown block.
const demoGate = evaluateExecutionGate({
  decision: "BUY",
  confidence: 80,
  accountMode: "demo",
  validationValid: true,
  riskAllowed: true,
  executionEnabled: true,
});
assert(demoGate.executable === true, `demo gate must allow BUY: ${demoGate.blockedBy.join(" | ")}`);

const realGate = evaluateExecutionGate({
  decision: "BUY",
  confidence: 80,
  accountMode: "real",
  validationValid: true,
  riskAllowed: true,
  executionEnabled: true,
});
assert(realGate.executable === true, `real gate must allow BUY: ${realGate.blockedBy.join(" | ")}`);

for (const mode of ["contest", "unknown"] as const) {
  const blockedMode = evaluateExecutionGate({
    decision: "BUY",
    confidence: 80,
    accountMode: mode,
    validationValid: true,
    riskAllowed: true,
    executionEnabled: true,
  });
  assert(blockedMode.executable === false, `${mode} account must never be executable`);
  assert(blockedMode.blockedBy.length > 0, `${mode} must record a block reason`);
}

const demoEnvOff = evaluateExecutionGate({
  decision: "BUY",
  confidence: 80,
  accountMode: "demo",
  validationValid: true,
  riskAllowed: true,
  executionEnabled: false,
});
assert(demoEnvOff.executable === false, "env kill switch must block execution");

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

// Exit engine: HOLD tidak pernah executable; CLOSE executable di demo dan real.
const closeDemo = decideExit({
  positions: [
    {
      id: "p1",
      symbol: "XAUUSD",
      side: "SELL",
      lot: 0.01,
      openPrice: 2310,
      stopLoss: null,
      takeProfit: null,
      openedAt: Date.now(),
      floatingPnl: 0,
    },
  ],
  trend: { ...trend, direction: "bullish", regime: "TRENDING_BULLISH" },
  momentum: {
    alignedWithTrend: true,
    direction: "bullish",
    strength: 0.7,
    notes: ["M1 supports bullish reversal"],
  },
  execution: { accountMode: "demo", executionEnabled: true },
});
assert(closeDemo.decision === "CLOSE", "flipped bias must CLOSE");
assert(closeDemo.executable === true, "CLOSE on demo must be executable");

const closeLive = decideExit({
  positions: [
    {
      id: "p1",
      symbol: "XAUUSD",
      side: "SELL",
      lot: 0.01,
      openPrice: 2310,
      stopLoss: null,
      takeProfit: null,
      openedAt: Date.now(),
      floatingPnl: 0,
    },
  ],
  trend: { ...trend, direction: "bullish", regime: "TRENDING_BULLISH" },
  momentum: {
    alignedWithTrend: true,
    direction: "bullish",
    strength: 0.7,
    notes: ["M1 supports bullish reversal"],
  },
  execution: { accountMode: "real", executionEnabled: true },
});
assert(closeLive.decision === "CLOSE", "flipped bias must CLOSE on live too");
assert(closeLive.executable === true, "CLOSE on live account must be executable");

const holdSignal = decideExit({
  positions: [],
  trend,
  execution: { accountMode: "demo", executionEnabled: true },
});
assert(holdSignal.decision === "HOLD" && holdSignal.executable === false, "HOLD never executable");

console.log("smoke ok");
