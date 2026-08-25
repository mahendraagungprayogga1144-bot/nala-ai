/**
 * Deterministic decision cases: BUY, SELL, WAIT.
 * Run: npx tsx lib/trading-ai/tests/decision-cases.ts
 */

import { analyzeTrend } from "../brain/trend-analyzer";
import { decideEntry } from "../brain/entry-decision";
import { decideExit } from "../brain/exit-decision";
import { dynamicTakeProfitDistance } from "../brain/dynamic-tp";
import { detectSequencedSetup } from "../brain/setup-sequence";
import { findSwings, lastClosedIndex, lastSwings } from "../brain/price-action";
import { decideTradingAction } from "../decide";
import {
  DEFAULT_TRADING_AI_CONFIG,
  EXECUTION_MIN_CONFIDENCE,
  HARD_RULES,
  mergeTradingAiConfig,
} from "../config";
import { evaluateExecutionGate, parseAccountMode } from "../execution-gate";
import {
  DEFAULT_EXECUTION_CONTROL,
  clampLot,
  evaluateRuntimeControl,
  parseExecutionControlRow,
  type ExecutionControlState,
} from "../execution-control";
import { isSignalFresh, SIGNAL_FRESHNESS_MS } from "../signal-freshness";
import { toEaTradeSignal } from "../signal";
import type { Candle, MarketRegime, MarketSnapshot, TrendAnalysis } from "../types";

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000 + i * 60, open: o, high: h, low: l, close: c };
}

function market(bid: number): MarketSnapshot {
  return { symbol: "XAUUSD", bid, ask: bid + 0.2, spread: 20, at: Date.now() };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function trendOf(
  direction: "bullish" | "bearish" | "sideways" | "unknown",
  strength = 0.7,
): TrendAnalysis {
  const regime: MarketRegime =
    direction === "bullish"
      ? "TRENDING_BULLISH"
      : direction === "bearish"
        ? "TRENDING_BEARISH"
        : direction === "sideways"
          ? "RANGE"
          : "UNCLEAR";
  return { timeframe: "M5", direction, regime, strength, notes: [] };
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
  let px = 2315;
  // Dump tajam ke dasar
  for (let i = 0; i < 26; i++) {
    const o = px;
    const c = px - 0.45;
    out.push(candle(i, o, o + 0.08, c - 0.06, c));
    px = c;
  }
  // 2–3 stall hijau di dasar (momentum resume) + forming
  for (let k = 0; k < 3; k++) {
    const o = px;
    const c = px + 0.14;
    out.push(candle(out.length, o, c + 0.04, o - 0.16, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.02, px - 0.02, px));
  return out;
}

function buildBearishM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2325;
  for (let i = 0; i < 24; i++) {
    const o = px;
    const c = px - 0.4;
    out.push(candle(i, o, o + 0.06, c - 0.08, c));
    px = c;
  }
  for (let k = 0; k < 3; k++) {
    const o = px;
    const c = px + 0.22;
    out.push(candle(out.length, o, c + 0.05, o - 0.04, c));
    px = c;
  }
  const o = px;
  const c = px - 0.14;
  out.push(candle(out.length, o, o + 0.12, c - 0.04, c));
  // second red for momentum resume
  const o2 = c;
  const c2 = c - 0.1;
  out.push(candle(out.length, o2, o2 + 0.06, c2 - 0.03, c2));
  out.push(candle(out.length, c2, c2 + 0.02, c2 - 0.02, c2));
  return out;
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
  assert(HARD_RULES.ALLOW_LIVE_EXECUTION === true, "live execution must be open");
  console.log("PASS WAIT", r.decision, "conf=", r.confidence, "trend=", r.trend.direction);
}

// --- WAIT tetap non-executable walau demo + eksekusi aktif ---
{
  const r = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBullishM5().slice(0, 5),
      m1Candles: buildBullishM1().slice(0, 5),
      market: market(2300),
      openPositions: [],
    },
    { accountMode: "demo", executionEnabled: true },
  );
  assert(r.decision === "WAIT", `WAIT/demo case failed: ${r.decision}`);
  assert(r.executable === false, "WAIT must never be executable, even on demo");
  console.log("PASS WAIT demo non-executable");
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
  assert(r.executable === false, "BUY without account mode must stay advisory");
  console.log("PASS BUY", r.decision, "conf=", r.confidence);
}

// --- BUY di akun DEMO: boleh executable ---
{
  const r = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBullishM5(),
      m1Candles: buildBullishM1(),
      market: market(buildBullishM1().at(-1)!.close),
      openPositions: [],
    },
    { config, accountMode: "demo", executionEnabled: true },
  );
  assert(r.decision === "BUY", `demo BUY failed: ${r.decision}`);
  assert(r.confidence >= EXECUTION_MIN_CONFIDENCE, `confidence ${r.confidence} < ${EXECUTION_MIN_CONFIDENCE}`);
  assert(r.executable === true, `demo BUY must be executable: ${r.execution.blockedBy.join(" | ")}`);
  assert(r.execution.accountMode === "demo", "gate records demo");
  assert(r.audit.executable === true, "audit records executable");
  console.log("PASS BUY demo executable", "conf=", r.confidence);
}

// --- LIVE: real boleh executable; contest/unknown tetap ditolak ---
{
  const live = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBullishM5(),
      m1Candles: buildBullishM1(),
      market: market(buildBullishM1().at(-1)!.close),
      openPositions: [],
    },
    { config, accountMode: "real", executionEnabled: true },
  );
  assert(live.decision === "BUY", `real setup should still decide BUY, got ${live.decision}`);
  assert(live.executable === true, `real BUY must be executable: ${live.execution.blockedBy.join(" | ")}`);
  assert(live.execution.accountMode === "real", "gate records real");

  for (const mode of ["contest", "unknown"] as const) {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: buildBullishM5(),
        m1Candles: buildBullishM1(),
        market: market(buildBullishM1().at(-1)!.close),
        openPositions: [],
      },
      { config, accountMode: mode, executionEnabled: true },
    );
    assert(r.decision === "BUY", `${mode} setup should still decide BUY, got ${r.decision}`);
    assert(r.executable === false, `${mode} account must never be executable`);
    assert(r.audit.executable === false, `${mode} audit must record non-executable`);
  }
  console.log("PASS real executable / contest+unknown blocked");
}

// --- Confidence di bawah ambang: demo pun tidak executable ---
{
  const gate = evaluateExecutionGate({
    decision: "BUY",
    confidence: EXECUTION_MIN_CONFIDENCE - 1,
    accountMode: "demo",
    validationValid: true,
    riskAllowed: true,
    executionEnabled: true,
  });
  assert(gate.executable === false, "confidence below threshold must block");

  const ok = evaluateExecutionGate({
    decision: "BUY",
    confidence: EXECUTION_MIN_CONFIDENCE,
    accountMode: "demo",
    validationValid: true,
    riskAllowed: true,
    executionEnabled: true,
  });
  assert(ok.executable === true, "confidence at threshold must pass on demo");

  // Config brain yang lebih longgar tidak boleh menurunkan ambang eksekusi.
  const lowered = evaluateExecutionGate({
    decision: "BUY",
    confidence: 50,
    accountMode: "demo",
    validationValid: true,
    riskAllowed: true,
    executionEnabled: true,
    configMinConfidence: 10,
  });
  assert(lowered.executable === false, "gate must not go below EXECUTION_MIN_CONFIDENCE");
  console.log("PASS confidence threshold");
}

// --- parseAccountMode fail-closed ---
{
  assert(parseAccountMode("demo") === "demo", "demo parsed");
  assert(parseAccountMode("DEMO") === "demo", "case-insensitive demo");
  assert(parseAccountMode("real") === "real", "real parsed");
  assert(parseAccountMode("live") === "real", "live maps to real");
  assert(parseAccountMode(null) === "unknown", "missing param is unknown");
  assert(parseAccountMode("demo ") === "demo", "trimmed");
  assert(parseAccountMode("demo-ish") === "unknown", "no fuzzy match to demo");
  console.log("PASS parseAccountMode");
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

  const demo = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1[m1.length - 1].close),
      openPositions: [],
    },
    { config, accountMode: "demo", executionEnabled: true },
  );
  assert(demo.decision === "SELL", `demo SELL failed: ${demo.decision}`);
  assert(demo.executable === true, `demo SELL must be executable: ${demo.execution.blockedBy.join(" | ")}`);

  const live = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1[m1.length - 1].close),
      openPositions: [],
    },
    { config, accountMode: "real", executionEnabled: true },
  );
  assert(live.executable === true, `live SELL must be executable: ${live.execution.blockedBy.join(" | ")}`);
  console.log("PASS SELL demo + real executable");
}

// --- Execution control: tombol autotrade, emergency stop, cooldown ---
{
  const on: ExecutionControlState = {
    ...DEFAULT_EXECUTION_CONTROL,
    autotradeEnabled: true,
  };

  assert(
    DEFAULT_EXECUTION_CONTROL.autotradeEnabled === false,
    "default autotrade harus OFF",
  );
  assert(
    parseExecutionControlRow(null).autotradeEnabled === false,
    "baris DB hilang harus jatuh ke OFF",
  );
  assert(
    parseExecutionControlRow({ autotrade_enabled: true }).autotradeEnabled === true,
    "baris DB ON terbaca",
  );
  assert(clampLot(0.05) === 0.05, "lot 0.05 lolos");
  assert(clampLot(99) === DEFAULT_TRADING_AI_CONFIG.risk.maxLot, "lot di-cap maxLot");
  assert(clampLot(-1) === DEFAULT_TRADING_AI_CONFIG.risk.defaultLot, "lot invalid → default");
  assert(
    parseExecutionControlRow({ lot: 0.02 }).lot === 0.02,
    "lot dari DB terbaca",
  );

  // Autotrade OFF memblokir semua eksekusi.
  const off = evaluateRuntimeControl({
    decision: "BUY",
    state: DEFAULT_EXECUTION_CONTROL,
  });
  assert(off.allowed === false, "autotrade OFF harus memblokir BUY");

  // Autotrade ON tanpa cooldown meloloskan entry.
  const clear = evaluateRuntimeControl({ decision: "BUY", state: on });
  assert(clear.allowed === true, `autotrade ON harus lolos: ${clear.blockedBy.join(" | ")}`);

  // Emergency stop menghentikan entry baru, tapi CLOSE tetap boleh.
  const stopped: ExecutionControlState = { ...on, emergencyStop: true };
  assert(
    evaluateRuntimeControl({ decision: "BUY", state: stopped }).allowed === false,
    "emergency stop harus memblokir entry",
  );
  assert(
    evaluateRuntimeControl({ decision: "CLOSE", state: stopped }).allowed === true,
    "CLOSE tetap boleh saat emergency stop",
  );
  assert(
    evaluateRuntimeControl({
      decision: "CLOSE",
      state: { ...stopped, closeAllOnStop: true },
      hasOpenPosition: true,
    }).forceClose === true,
    "close-all harus memicu forceClose",
  );
  assert(
    evaluateRuntimeControl({
      decision: "CLOSE",
      state: { ...stopped, closeAllOnStop: true },
      hasOpenPosition: false,
    }).forceClose === false,
    "forceClose butuh posisi terbuka",
  );

  // Cooldown menahan entry, tidak menahan CLOSE.
  const now = 1_800_000_000_000;
  const cooling: ExecutionControlState = {
    ...on,
    cooldownSeconds: 900,
    lastEntryAt: now - 300_000,
  };
  const cooled = evaluateRuntimeControl({ decision: "BUY", state: cooling, now });
  assert(cooled.allowed === false, "cooldown harus memblokir entry");
  assert(cooled.cooldownRemainingSec === 600, `sisa cooldown salah: ${cooled.cooldownRemainingSec}`);
  assert(
    evaluateRuntimeControl({ decision: "CLOSE", state: cooling, now }).allowed === true,
    "cooldown tidak boleh menahan CLOSE",
  );
  assert(
    evaluateRuntimeControl({
      decision: "BUY",
      state: { ...cooling, lastEntryAt: now - 900_001 },
      now,
    }).allowed === true,
    "cooldown lewat harus lolos",
  );
  // Satu signal = satu attempt, ditegakkan server (tahan restart EA).
  const replayed: ExecutionControlState = {
    ...on,
    lastEntrySignalId: "sig_XAUUSD_1700000000_BUY_80",
  };
  assert(
    evaluateRuntimeControl({
      decision: "BUY",
      state: replayed,
      signalId: "sig_XAUUSD_1700000000_BUY_80",
    }).allowed === false,
    "signal yang sudah dieksekusi tidak boleh diulang",
  );
  assert(
    evaluateRuntimeControl({
      decision: "BUY",
      state: replayed,
      signalId: "sig_XAUUSD_1700000060_BUY_80",
    }).allowed === true,
    "signal dari bar baru tetap boleh",
  );

  // LIVE ENABLE: REAL blocked when off; DEMO ignores; REAL ok when on.
  assert(
    DEFAULT_EXECUTION_CONTROL.liveEnable === false,
    "default liveEnable harus OFF",
  );
  assert(
    parseExecutionControlRow({ live_enable: true }).liveEnable === true,
    "live_enable DB ON terbaca",
  );
  const realBlocked = evaluateRuntimeControl({
    decision: "BUY",
    state: on,
    accountMode: "real",
  });
  assert(
    realBlocked.allowed === false,
    "REAL + liveEnable OFF harus memblokir entry",
  );
  assert(
    realBlocked.blockedBy.some((b) => /LIVE EXECUTION DISABLED/i.test(b)),
    "blocker REAL harus menyebut LIVE EXECUTION DISABLED",
  );
  assert(
    evaluateRuntimeControl({
      decision: "BUY",
      state: on,
      accountMode: "demo",
    }).allowed === true,
    "DEMO mengabaikan liveEnable",
  );
  assert(
    evaluateRuntimeControl({
      decision: "BUY",
      state: { ...on, liveEnable: true },
      accountMode: "real",
    }).allowed === true,
    "REAL + liveEnable ON harus lolos",
  );
  assert(
    evaluateRuntimeControl({
      decision: "CLOSE",
      state: on,
      accountMode: "real",
    }).allowed === true,
    "CLOSE tetap boleh pada REAL tanpa liveEnable",
  );
  console.log("PASS execution control (autotrade / emergency stop / cooldown / liveEnable)");
}

// --- Control layer hanya boleh MEMPERSEMPIT izin execution gate ---
{
  const m5 = buildBullishM5();
  const m1 = buildBullishM1();
  const r = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1[m1.length - 1].close),
      openPositions: [],
    },
    { config, accountMode: "demo", executionEnabled: true },
  );
  assert(r.executable === true, "prasyarat: demo BUY executable");

  const allowed = toEaTradeSignal(r, {
    barTime: m1[m1.length - 1].time,
    autotrade: true,
    lot: 0.05,
    now: r.generatedAt,
  });
  assert(allowed.serverExecutable === true, "tanpa blocker runtime harus tetap executable");
  assert(allowed.executionMode === "LIVE_AUTOTRADE", "mode harus LIVE_AUTOTRADE");
  assert(allowed.lot === 0.05, "lot dashboard override suggestedLot");
  assert(allowed.m5Bias === "bullish", "m5Bias ikut dikirim ke EA");

  const blocked = toEaTradeSignal(r, {
    barTime: m1[m1.length - 1].time,
    controlBlockedBy: ["LIVE AUTOTRADE OFF"],
    now: r.generatedAt,
  });
  assert(blocked.serverExecutable === false, "blocker runtime harus mematikan eksekusi");

  const stale = toEaTradeSignal(r, {
    barTime: m1[m1.length - 1].time,
    autotrade: true,
    now: r.generatedAt + 25_000,
  });
  assert(stale.serverExecutable === false, "signal >20s harus stale");
  assert(
    stale.executionBlockedBy.some((b) => /stale signal/i.test(b)),
    "blocker stale harus ada",
  );

  // signalId stabil dalam satu bar M1 → satu signal = satu order attempt.
  const again = toEaTradeSignal(r, { barTime: m1[m1.length - 1].time, now: r.generatedAt });
  assert(allowed.signalId === again.signalId, "signalId harus stabil dalam bar yang sama");
  const nextBar = toEaTradeSignal(r, {
    barTime: m1[m1.length - 1].time + 60,
    now: r.generatedAt,
  });
  assert(allowed.signalId !== nextBar.signalId, "bar baru harus menghasilkan signalId baru");
  console.log("PASS control layer + signalId stabil + freshness");
}

// --- M5 sideways → range-box scalp; unknown → WAIT ---
{
  const waitUnknown = decideEntry({
    trend: trendOf("unknown", 0),
    pullback: { detected: true, depth: 0.4, nearLevel: 2300, notes: [] },
    rejection: { detected: true, side: "bullish", atPrice: 2300, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2305,
    },
    marketPrice: 2301,
    config,
    nearLevel: true,
    entryDistance: 1.0,
  });
  assert(waitUnknown.decision === "WAIT", "unknown M5 harus WAIT");

  const buyBox = decideEntry({
    trend: trendOf("sideways", 0.35),
    pullback: { detected: true, depth: 0.4, nearLevel: 2300, notes: [] },
    rejection: { detected: true, side: "bullish", atPrice: 2300, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2305,
    },
    marketPrice: 2300.3,
    config,
    nearLevel: true,
    entryDistance: 0.3,
  });
  assert(buyBox.decision === "BUY", `sideways + bullish M1 harus BUY, got ${buyBox.decision}`);

  const sellBox = decideEntry({
    trend: trendOf("sideways", 0.35),
    pullback: { detected: true, depth: 0.4, nearLevel: 2305, notes: [] },
    rejection: { detected: true, side: "bearish", atPrice: 2305, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2305,
    },
    marketPrice: 2304.7,
    config,
    nearLevel: true,
    entryDistance: 0.3,
  });
  assert(sellBox.decision === "SELL", `sideways + bearish M1 harus SELL, got ${sellBox.decision}`);

  const peakBuy = decideEntry({
    trend: trendOf("sideways", 0.35),
    pullback: {
      detected: true,
      depth: 0.4,
      nearLevel: 2300,
      notes: ["Exhaustion bottom — BUY hanya di dasar."],
    },
    rejection: { detected: true, side: "bullish", atPrice: 2300, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.8,
      notes: ["Exhaustion: buy the bottom after dump."],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2305,
    },
    marketPrice: 2304.5, // kejar naik dari dasar → tolak
    config,
    nearLevel: false,
    entryDistance: 4.5,
  });
  assert(peakBuy.decision === "WAIT", `kejar BUY harus WAIT, got ${peakBuy.decision}`);

  const sellTop = decideEntry({
    trend: trendOf("bullish", 0.7),
    pullback: {
      detected: true,
      depth: 0.35,
      nearLevel: 2312,
      notes: ["Exhaustion top — SELL hanya di pucuk."],
    },
    rejection: { detected: true, side: "bearish", atPrice: 2312, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.72,
      notes: ["Exhaustion: sell the top after spike."],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2314,
    },
    marketPrice: 2311.8,
    config,
    nearLevel: true,
    entryDistance: 0.2,
  });
  assert(
    sellTop.decision === "WAIT",
    `M5 bullish = BUY bias only, SELL pucuk harus WAIT, got ${sellTop.decision}`,
  );

  const buyBottom = decideEntry({
    trend: trendOf("bearish", 0.7),
    pullback: {
      detected: true,
      depth: 0.35,
      nearLevel: 2299,
      notes: ["Exhaustion bottom — BUY hanya di dasar."],
    },
    rejection: { detected: true, side: "bullish", atPrice: 2299, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.72,
      notes: ["Exhaustion: buy the bottom after dump."],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2314,
    },
    marketPrice: 2299.2,
    config,
    nearLevel: true,
    entryDistance: 0.2,
  });
  assert(
    buyBottom.decision === "WAIT",
    `M5 bearish = SELL bias only, BUY dasar harus WAIT, got ${buyBottom.decision}`,
  );

  assert(
    /BRAIN_CONSISTENCY_FAIL/i.test(sellTop.reason) || sellTop.consistencyFail,
    "SELL vs bullish M5 harus consistency fail",
  );

  console.log("PASS extreme-only + chase reject + top/bottom");
}

function buildDipResumeBullishM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2310;
  for (let i = 0; i < 24; i++) {
    const o = px;
    const c = px + 0.25;
    out.push(candle(i, o, c + 0.05, o - 0.05, c));
    px = c;
  }
  for (let k = 0; k < 3; k++) {
    const o = px;
    const c = px - 0.38;
    out.push(candle(out.length, o, o + 0.04, c - 0.1, c));
    px = c;
  }
  const o = px;
  const c = px + 0.14;
  out.push(candle(out.length, o, c + 0.03, o - 0.16, c));
  const o2 = c;
  const c2 = c + 0.12;
  out.push(candle(out.length, o2, c2 + 0.03, o2 - 0.1, c2));
  out.push(candle(out.length, c2, c2 + 0.02, c2 - 0.02, c2));
  return out;
}

function buildBounceResumeBearishM1(): Candle[] {
  return invertSeries(buildDipResumeBullishM1());
}

function buildDumpOnlyM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2320;
  for (let i = 0; i < 32; i++) {
    const o = px;
    const c = px - 0.4;
    out.push(candle(i, o, o + 0.04, c - 0.04, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.02, px - 0.02, px));
  return out;
}

/** Rally M1 lalu 1 merah di high — jangan SELL lawan tape. */
function buildRallyThenRedM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2300;
  for (let i = 0; i < 28; i++) {
    const o = px;
    const c = px + 0.45;
    out.push(candle(i, o, c + 0.08, o - 0.04, c));
    px = c;
  }
  const o = px;
  const c = px - 0.12;
  out.push(candle(out.length, o, o + 0.04, c - 0.04, c));
  out.push(candle(out.length, c, c + 0.02, c - 0.02, c));
  return out;
}

// --- Bisa ganti: dip/bounce lanjutan + structure break, tanpa kejar dump ---
{
  const dipBuy = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBullishM5(),
      m1Candles: buildDipResumeBullishM1(),
      market: market(buildDipResumeBullishM1().at(-1)!.close),
      openPositions: [],
    },
    { config },
  );
  assert(
    dipBuy.decision === "BUY",
    `M5 bullish + dip M1 harus BUY, got ${dipBuy.decision} conf=${dipBuy.confidence} ${dipBuy.reasons.join(" | ")}`,
  );

  const bounceSell = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBearishM5(),
      m1Candles: buildBounceResumeBearishM1(),
      market: market(buildBounceResumeBearishM1().at(-1)!.close),
      openPositions: [],
    },
    { config },
  );
  assert(
    bounceSell.decision === "SELL",
    `M5 bearish + bounce M1 harus SELL, got ${bounceSell.decision} conf=${bounceSell.confidence} ${bounceSell.reasons.join(" | ")}`,
  );

  const chaseDump = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBearishM5(),
      m1Candles: buildDumpOnlyM1(),
      market: market(buildDumpOnlyM1().at(-1)!.close),
      openPositions: [],
    },
    { config },
  );
  assert(
    chaseDump.decision === "WAIT",
    `dump tanpa bounce harus WAIT, got ${chaseDump.decision} ${chaseDump.reasons.join(" | ")}`,
  );

  const fadeRally = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBearishM5(),
      m1Candles: buildRallyThenRedM1(),
      market: market(buildRallyThenRedM1().at(-1)!.close),
      openPositions: [],
    },
    { config },
  );
  assert(
    fadeRally.decision === "WAIT",
    `M1 rally jangan di-SELL, got ${fadeRally.decision} ${fadeRally.reasons.join(" | ")}`,
  );

  const broken = buildBearishM5();
  const closed = lastClosedIndex(broken);
  const lastHigh = lastSwings(findSwings(broken, 2, 2), "high", 1)[0]?.price;
  assert(lastHigh != null && lastHigh > 0, "bearish M5 must have a swing high");
  const modest = broken[closed];
  broken[closed] = candle(
    closed,
    lastHigh - 0.15,
    lastHigh + 0.35,
    Math.min(modest.low, lastHigh - 0.2),
    lastHigh + 0.22,
  );
  const brokenTrend = analyzeTrend(broken, config);
  assert(
    brokenTrend.direction !== "bearish",
    `close di atas swing high tidak boleh tetap SELL-only, got ${brokenTrend.direction} notes=${brokenTrend.notes.join(" | ")}`,
  );

  const spike = buildBearishM5();
  const spikeClosed = spike.length - 2;
  const peak = Math.max(...spike.slice(0, spikeClosed).map((c) => c.high));
  spike[spikeClosed] = candle(spikeClosed, peak - 0.2, peak + 3, peak - 0.4, peak + 2.4);
  const spikeTrend = analyzeTrend(spike, config);
  assert(
    spikeTrend.direction !== "bearish",
    `spike balik tidak boleh tetap SELL-only, got ${spikeTrend.direction}`,
  );

  console.log("PASS switch-bias dip/bounce + no-chase dump + structure break");
}

// --- Exit: momentum lost protects floating profit ---
{
  assert(isSignalFresh(Date.now() - 1000), "fresh within 1s");
  assert(!isSignalFresh(Date.now() - (SIGNAL_FRESHNESS_MS + 1)), "stale after threshold");
  assert(!isSignalFresh(null), "missing generatedAt = stale");

  const tp = dynamicTakeProfitDistance({
    marketPrice: 2300,
    riskDistance: 1.5,
    m5Strength: 0.9,
    momentumStrength: 0.9,
    baseRr: 1.5,
  });
  assert(tp >= 1.0, `dynamic TP min band: ${tp}`);

  const close = decideExit({
    positions: [
      {
        id: "1",
        symbol: "XAUUSD",
        side: "BUY",
        lot: 0.01,
        openPrice: 2300,
        stopLoss: 2298,
        takeProfit: 2305,
        openedAt: Date.now(),
        floatingPnl: 12,
      },
    ],
    trend: trendOf("bullish", 0.7),
    momentum: {
      direction: "bearish",
      strength: 0.2,
      alignedWithTrend: false,
      notes: ["against"],
    },
    execution: { accountMode: "demo", executionEnabled: true },
  });
  assert(close.decision === "CLOSE", `profit protect harus CLOSE, got ${close.decision}`);
  assert(
    /MOMENTUM_LOST|PROFIT_PROTECT/i.test(close.reason),
    `reason: ${close.reason}`,
  );
  console.log("PASS freshness + dynamic TP + momentum exit");
}

// --- FINAL TEST: 12 human-style cases ---
{
  const srNear = {
    timeframe: "M5" as const,
    levels: [],
    nearestSupport: 2299,
    nearestResistance: 2305,
  };

  // CASE 1: M5 bearish + M1 bullish pullback → WAIT
  {
    const e = decideEntry({
      trend: trendOf("bearish", 0.8),
      pullback: { detected: true, depth: 0.3, nearLevel: 2305, notes: ["pullback up"] },
      rejection: { detected: false, side: null, atPrice: null, notes: [] },
      momentum: {
        alignedWithTrend: false,
        direction: "bullish",
        strength: 0.5,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2304,
      config,
      nearLevel: true,
      entryDistance: 0.5,
    });
    assert(e.decision === "WAIT", `CASE1 expected WAIT, got ${e.decision}`);
    console.log("PASS CASE1 M5 bear + M1 bull pullback → WAIT");
  }

  // CASE 2: full SELL chain → SELL
  {
    const e = decideEntry({
      trend: trendOf("bearish", 0.85),
      pullback: { detected: true, depth: 0.35, nearLevel: 2305, notes: [] },
      rejection: { detected: true, side: "bearish", atPrice: 2305.2, notes: [] },
      momentum: {
        alignedWithTrend: true,
        direction: "bearish",
        strength: 0.75,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2304.8,
      config,
      nearLevel: true,
      entryDistance: 0.2,
    });
    assert(e.decision === "SELL", `CASE2 expected SELL, got ${e.decision} ${e.reason}`);
    assert(e.entryQuality !== "WEAK", `CASE2 quality ${e.entryQuality}`);
    console.log("PASS CASE2 full SELL chain → SELL");
  }

  // CASE 3: M5 bull + M1 bear pullback → WAIT
  {
    const e = decideEntry({
      trend: trendOf("bullish", 0.8),
      pullback: { detected: true, depth: 0.3, nearLevel: 2299, notes: [] },
      rejection: { detected: false, side: null, atPrice: null, notes: [] },
      momentum: {
        alignedWithTrend: false,
        direction: "bearish",
        strength: 0.5,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2300,
      config,
      nearLevel: true,
      entryDistance: 0.4,
    });
    assert(e.decision === "WAIT", `CASE3 expected WAIT, got ${e.decision}`);
    console.log("PASS CASE3 M5 bull + M1 bear pullback → WAIT");
  }

  // CASE 4: BUY at support → BUY
  {
    const e = decideEntry({
      trend: trendOf("bullish", 0.85),
      pullback: { detected: true, depth: 0.35, nearLevel: 2299, notes: [] },
      rejection: { detected: true, side: "bullish", atPrice: 2298.8, notes: [] },
      momentum: {
        alignedWithTrend: true,
        direction: "bullish",
        strength: 0.75,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2299.2,
      config,
      nearLevel: true,
      entryDistance: 0.2,
    });
    assert(e.decision === "BUY", `CASE4 expected BUY, got ${e.decision} ${e.reason}`);
    console.log("PASS CASE4 support rejection → BUY");
  }

  // CASE 5: RANGE near resistance → SELL
  {
    const e = decideEntry({
      trend: trendOf("sideways", 0.4),
      pullback: { detected: true, depth: 0.3, nearLevel: 2305, notes: [] },
      rejection: { detected: true, side: "bearish", atPrice: 2305.1, notes: [] },
      momentum: {
        alignedWithTrend: true,
        direction: "bearish",
        strength: 0.7,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2304.9,
      config,
      nearLevel: true,
      entryDistance: 0.1,
    });
    assert(e.decision === "SELL", `CASE5 expected SELL, got ${e.decision}`);
    console.log("PASS CASE5 RANGE near R → SELL");
  }

  // CASE 6: RANGE middle → WAIT (via setup-sequence)
  {
    const m1 = buildDumpOnlyM1();
    const midPx = m1[m1.length - 1].close;
    const mid = detectSequencedSetup(m1, "sideways", config, {
      timeframe: "M5",
      levels: [],
      nearestSupport: midPx - 5,
      nearestResistance: midPx + 5,
    });
    assert(mid.m1State === "WAIT" || !mid.rejection.detected, `CASE6 middle state=${mid.m1State}`);
    assert(/middle/i.test(mid.pullback.notes[0] || mid.rejection.notes[0] || ""), `CASE6 note: ${mid.pullback.notes[0]}`);
    console.log("PASS CASE6 RANGE middle → WAIT");
  }

  // CASE 7: chase → WAIT
  {
    const e = decideEntry({
      trend: trendOf("bearish", 0.8),
      pullback: { detected: true, depth: 0.3, nearLevel: 2305, notes: [] },
      rejection: { detected: true, side: "bearish", atPrice: 2305, notes: [] },
      momentum: {
        alignedWithTrend: true,
        direction: "bearish",
        strength: 0.7,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2300,
      config,
      nearLevel: false,
      entryDistance: 5,
    });
    assert(e.decision === "WAIT", `CASE7 chase expected WAIT, got ${e.decision}`);
    console.log("PASS CASE7 chase → WAIT");
  }

  // CASE 8: consistency fail
  {
    const e = decideEntry({
      trend: trendOf("bullish", 0.8),
      pullback: { detected: true, depth: 0.3, nearLevel: 2310, notes: [] },
      rejection: { detected: true, side: "bearish", atPrice: 2310, notes: [] },
      momentum: {
        alignedWithTrend: true,
        direction: "bearish",
        strength: 0.7,
        notes: [],
      },
      supportResistance: srNear,
      marketPrice: 2309.5,
      config,
      nearLevel: true,
      entryDistance: 0.2,
    });
    assert(e.decision === "WAIT", `CASE8 expected WAIT, got ${e.decision}`);
    assert(
      e.consistencyFail || /BRAIN_CONSISTENCY_FAIL/i.test(e.reason),
      `CASE8 consistency: ${e.reason}`,
    );
    console.log("PASS CASE8 BRAIN_CONSISTENCY_FAIL → WAIT");
  }

  // CASE 9: position active → no new entry
  {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: buildBullishM5(),
        m1Candles: buildDipResumeBullishM1(),
        market: market(buildDipResumeBullishM1().at(-1)!.close),
        openPositions: [
          {
            id: "p1",
            symbol: "XAUUSD",
            side: "BUY",
            lot: 0.1,
            openPrice: 2300,
            stopLoss: 2298,
            takeProfit: 2305,
            openedAt: Date.now(),
            floatingPnl: 1,
          },
        ],
      },
      { config },
    );
    assert(
      r.decision === "WAIT" || r.decision === "CLOSE",
      `CASE9 no new entry, got ${r.decision}`,
    );
    assert(r.decision !== "BUY" && r.decision !== "SELL", "CASE9 must not open second side");
    console.log("PASS CASE9 position active → no new entry");
  }

  // CASE 10: profit + momentum weakening → CLOSE
  {
    const close = decideExit({
      positions: [
        {
          id: "1",
          symbol: "XAUUSD",
          side: "SELL",
          lot: 0.1,
          openPrice: 2305,
          stopLoss: 2307,
          takeProfit: 2300,
          openedAt: Date.now(),
          floatingPnl: 25,
        },
      ],
      trend: trendOf("bearish", 0.7),
      momentum: {
        direction: "bullish",
        strength: 0.2,
        alignedWithTrend: false,
        notes: ["weaken"],
      },
    });
    assert(close.decision === "CLOSE", `CASE10 expected CLOSE, got ${close.decision}`);
    console.log("PASS CASE10 profit + weaken → CLOSE");
  }

  // CASE 11: stale signal
  {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: buildBullishM5(),
        m1Candles: buildDipResumeBullishM1(),
        market: market(buildDipResumeBullishM1().at(-1)!.close),
        openPositions: [],
      },
      { config, accountMode: "demo", executionEnabled: true },
    );
    const stale = toEaTradeSignal(r, {
      barTime: buildDipResumeBullishM1().at(-1)!.time,
      autotrade: true,
      now: r.generatedAt + SIGNAL_FRESHNESS_MS + 1,
    });
    assert(stale.serverExecutable === false, "CASE11 stale must block");
    assert(
      stale.executionBlockedBy.some((b) => /stale/i.test(b)),
      "CASE11 stale reason",
    );
    console.log("PASS CASE11 stale → WAIT/block");
  }

  // CASE 12: spread abnormal → WAIT
  {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: buildBullishM5(),
        m1Candles: buildDipResumeBullishM1(),
        market: {
          symbol: "XAUUSD",
          bid: buildDipResumeBullishM1().at(-1)!.close,
          ask: buildDipResumeBullishM1().at(-1)!.close + 1,
          spread: 120,
          at: Date.now(),
        },
        openPositions: [],
      },
      { config, accountMode: "demo", executionEnabled: true },
    );
    assert(r.decision === "WAIT", `CASE12 spread → WAIT, got ${r.decision}`);
    assert(r.executable === false, "CASE12 not executable");
    assert(
      r.risk.allowed === false || r.decision === "WAIT",
      "CASE12 risk/spread block",
    );
    console.log("PASS CASE12 spread abnormal → WAIT");
  }

  console.log("PASS FINAL TEST 12 cases");
}

console.log("decision-cases ok");
console.log("HARD_RULES", {
  MAX_POSITION: HARD_RULES.MAX_POSITION,
  NO_AVERAGING: HARD_RULES.NO_AVERAGING,
  NO_MARTINGALE: HARD_RULES.NO_MARTINGALE,
  NO_GRID: HARD_RULES.NO_GRID,
  NO_HEDGE: HARD_RULES.NO_HEDGE,
});
