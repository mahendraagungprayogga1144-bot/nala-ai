/**
 * Deterministic decision cases: BUY, SELL, WAIT.
 * Run: npx tsx lib/trading-ai/tests/decision-cases.ts
 */

import { analyzeTrend } from "../brain/trend-analyzer";
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
  evaluateRuntimeControl,
  parseExecutionControlRow,
  type ExecutionControlState,
} from "../execution-control";
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
  console.log("PASS execution control (autotrade / emergency stop / cooldown)");
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

  const allowed = toEaTradeSignal(r, { barTime: m1[m1.length - 1].time, autotrade: true });
  assert(allowed.serverExecutable === true, "tanpa blocker runtime harus tetap executable");
  assert(allowed.executionMode === "LIVE_AUTOTRADE", "mode harus LIVE_AUTOTRADE");
  assert(allowed.m5Bias === "bullish", "m5Bias ikut dikirim ke EA");

  const blocked = toEaTradeSignal(r, {
    barTime: m1[m1.length - 1].time,
    controlBlockedBy: ["LIVE AUTOTRADE OFF"],
  });
  assert(blocked.serverExecutable === false, "blocker runtime harus mematikan eksekusi");

  // signalId stabil dalam satu bar M1 → satu signal = satu order attempt.
  const again = toEaTradeSignal(r, { barTime: m1[m1.length - 1].time });
  assert(allowed.signalId === again.signalId, "signalId harus stabil dalam bar yang sama");
  const nextBar = toEaTradeSignal(r, { barTime: m1[m1.length - 1].time + 60 });
  assert(allowed.signalId !== nextBar.signalId, "bar baru harus menghasilkan signalId baru");
  console.log("PASS control layer + signalId stabil");
}

console.log("decision-cases ok");
console.log("HARD_RULES", {
  MAX_POSITION: HARD_RULES.MAX_POSITION,
  NO_AVERAGING: HARD_RULES.NO_AVERAGING,
  NO_MARTINGALE: HARD_RULES.NO_MARTINGALE,
  NO_GRID: HARD_RULES.NO_GRID,
  NO_HEDGE: HARD_RULES.NO_HEDGE,
});
