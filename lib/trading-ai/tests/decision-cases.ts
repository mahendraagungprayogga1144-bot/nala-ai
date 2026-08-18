/**
 * Deterministic decision cases: BUY, SELL, WAIT.
 * Run: npx tsx lib/trading-ai/tests/decision-cases.ts
 */

import { analyzeTrend } from "../brain/trend-analyzer";
import { decideEntry } from "../brain/entry-decision";
import { decideExit } from "../brain/exit-decision";
import { dynamicTakeProfitDistance } from "../brain/dynamic-tp";
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
  let px = 2305;
  // Pad + tekanan hijau (minM1Candles)
  for (let i = 0; i < 28; i++) {
    const o = px;
    const c = px + 0.35;
    out.push(candle(i, o, c + 0.15, o - 0.08, c));
    px = c;
  }
  // Entry: pullback merah dangkal (closed) + forming bar
  const o = px;
  const c = px - 0.45;
  out.push(candle(out.length, o, o + 0.06, c - 0.04, c));
  out.push(candle(out.length, c, c + 0.02, c - 0.02, c));
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
    trend: { timeframe: "M5", direction: "unknown", strength: 0, notes: [] },
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
  });
  assert(waitUnknown.decision === "WAIT", "unknown M5 harus WAIT");

  const buyBox = decideEntry({
    trend: { timeframe: "M5", direction: "sideways", strength: 0.35, notes: [] },
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
  });
  assert(buyBox.decision === "BUY", `sideways + bullish M1 harus BUY, got ${buyBox.decision}`);

  const sellBox = decideEntry({
    trend: { timeframe: "M5", direction: "sideways", strength: 0.35, notes: [] },
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
    marketPrice: 2303,
    config,
  });
  assert(sellBox.decision === "SELL", `sideways + bearish M1 harus SELL, got ${sellBox.decision}`);

  const peakBuy = decideEntry({
    trend: { timeframe: "M5", direction: "sideways", strength: 0.35, notes: [] },
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
    marketPrice: 2304.5, // dekat resistance → jangan BUY di pucuk
    config,
  });
  assert(peakBuy.decision === "WAIT", `BUY dekat resistance harus WAIT, got ${peakBuy.decision}`);

  const sellTop = decideEntry({
    trend: { timeframe: "M5", direction: "bullish", strength: 0.7, notes: [] },
    pullback: {
      detected: true,
      depth: 0.35,
      nearLevel: 2312,
      notes: ["Exhaustion top fade — sharp up then stall at high."],
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
    marketPrice: 2311.5,
    config,
  });
  assert(sellTop.decision === "SELL", `exhaustion top harus SELL, got ${sellTop.decision}`);

  const buyBottom = decideEntry({
    trend: { timeframe: "M5", direction: "bearish", strength: 0.7, notes: [] },
    pullback: {
      detected: true,
      depth: 0.35,
      nearLevel: 2299,
      notes: ["Exhaustion bottom bounce — sharp dump then stall at low."],
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
    marketPrice: 2300,
    config,
  });
  assert(buyBottom.decision === "BUY", `exhaustion bottom harus BUY, got ${buyBottom.decision}`);

  console.log("PASS sideways + exhaustion top/bottom + edge filter");
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
    trend: {
      timeframe: "M5",
      direction: "bullish",
      strength: 0.7,
      notes: [],
    },
    momentum: {
      direction: "bearish",
      strength: 0.2,
      alignedWithTrend: false,
      notes: ["against"],
    },
    execution: { accountMode: "demo", executionEnabled: true },
  });
  assert(close.decision === "CLOSE", `profit protect harus CLOSE, got ${close.decision}`);
  assert(/MOMENTUM_LOST/i.test(close.reason), `reason: ${close.reason}`);
  console.log("PASS freshness + dynamic TP + momentum exit");
}

console.log("decision-cases ok");
console.log("HARD_RULES", {
  MAX_POSITION: HARD_RULES.MAX_POSITION,
  NO_AVERAGING: HARD_RULES.NO_AVERAGING,
  NO_MARTINGALE: HARD_RULES.NO_MARTINGALE,
  NO_GRID: HARD_RULES.NO_GRID,
  NO_HEDGE: HARD_RULES.NO_HEDGE,
});
