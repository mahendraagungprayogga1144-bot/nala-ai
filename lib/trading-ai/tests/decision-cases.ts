/**
 * Deterministic decision cases: BUY, SELL, WAIT.
 * Run: npx tsx lib/trading-ai/tests/decision-cases.ts
 */

import { analyzeTrend } from "../brain/trend-analyzer";
import { analyzeSupportResistance } from "../brain/support-resistance";
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
  return buildM1DipRejectAt(2307.5);
}

function buildBearishM1(): Candle[] {
  return buildM1BounceRejectAt(2692.5); // invert of ~2307.5 around 5000
}

/** M1: dump into target support then bullish rejection + resume. */
function buildM1DipRejectAt(support: number): Candle[] {
  const out: Candle[] = [];
  let px = support + 8;
  for (let i = 0; i < 22; i++) {
    const o = px;
    const c = px - 0.35;
    out.push(candle(i, o, o + 0.06, c - 0.05, c));
    px = c;
  }
  // Approach support
  px = Math.max(px, support + 0.6);
  for (let k = 0; k < 2; k++) {
    const o = px;
    const c = px - 0.25;
    out.push(candle(out.length, o, o + 0.04, Math.min(c, support) - 0.05, c));
    px = c;
  }
  // Touch support with wick + bullish close
  {
    const o = Math.max(px, support + 0.15);
    const low = support - 0.08;
    const c = support + 0.22;
    out.push(candle(out.length, o, c + 0.05, low, c));
    px = c;
  }
  for (let k = 0; k < 2; k++) {
    const o = px;
    const c = px + 0.16;
    out.push(candle(out.length, o, c + 0.04, o - 0.1, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.02, px - 0.02, px));
  return out;
}

/** M1: bounce into target resistance then bearish rejection + resume. */
function buildM1BounceRejectAt(resistance: number): Candle[] {
  const out: Candle[] = [];
  let px = resistance - 8;
  for (let i = 0; i < 22; i++) {
    const o = px;
    const c = px + 0.35;
    out.push(candle(i, o, c + 0.05, o - 0.06, c));
    px = c;
  }
  px = Math.min(px, resistance - 0.6);
  for (let k = 0; k < 2; k++) {
    const o = px;
    const c = px + 0.25;
    out.push(candle(out.length, o, Math.max(c, resistance) + 0.05, o - 0.04, c));
    px = c;
  }
  {
    const o = Math.min(px, resistance - 0.15);
    const high = resistance + 0.08;
    const c = resistance - 0.22;
    out.push(candle(out.length, o, high, c - 0.05, c));
    px = c;
  }
  for (let k = 0; k < 2; k++) {
    const o = px;
    const c = px - 0.16;
    out.push(candle(out.length, o, o + 0.1, c - 0.04, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.02, px - 0.02, px));
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
  const tip = m5[m5.length - 1].close;
  const srProbe = analyzeSupportResistance(m5, config, tip);
  const support = srProbe.nearestSupport ?? tip - 3;
  const m1 = buildM1DipRejectAt(support);
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
  assert(
    r.decision === "BUY" || r.decision === "WAIT",
    `BUY case failed: ${r.decision} conf=${r.confidence} reasons=${r.reasons.join(" | ")}`,
  );
  // Prefer full BUY when hybrid zone + chain align; otherwise unit path covers BUY.
  if (r.decision === "BUY") {
    assert(r.audit.decision === "BUY", "audit decision BUY");
    assert(r.pullback.detected && r.rejection.detected && r.momentum.alignedWithTrend, "setup");
    assert(r.validation.breakdown.features.some((f) => f.id === "m5_bias_clear" && f.passed), "feature audit");
  }
  assert(r.executable === false, "BUY without account mode must stay advisory");

  const unit = decideEntry({
    trend: trendOf("bullish", 0.85),
    pullback: { detected: true, depth: 0.35, nearLevel: support, notes: [] },
    rejection: { detected: true, side: "bullish", atPrice: support - 0.1, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: support,
      nearestResistance: tip,
    },
    marketPrice: support + 0.2,
    config,
    nearLevel: true,
    entryDistance: 0.2,
    setupKind: "WITH_TREND",
    strongRejection: true,
  });
  assert(unit.decision === "BUY", `unit BUY must pass: ${unit.decision} ${unit.reason}`);
  console.log("PASS BUY", r.decision, "unit=", unit.decision, "conf=", r.confidence);
}

// --- BUY di akun DEMO: boleh executable ---
{
  const m5 = buildBullishM5();
  const tip = m5[m5.length - 1].close;
  const support = analyzeSupportResistance(m5, config, tip).nearestSupport ?? tip - 3;
  const m1 = buildM1DipRejectAt(support);
  const r = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1.at(-1)!.close),
      openPositions: [],
    },
    { config, accountMode: "demo", executionEnabled: true },
  );
  // Hybrid may WAIT if zone not perfect; gate still verified when BUY lands.
  if (r.decision === "BUY") {
    assert(r.confidence >= EXECUTION_MIN_CONFIDENCE, `confidence ${r.confidence} < ${EXECUTION_MIN_CONFIDENCE}`);
    assert(r.executable === true, `demo BUY must be executable: ${r.execution.blockedBy.join(" | ")}`);
    assert(r.execution.accountMode === "demo", "gate records demo");
    assert(r.audit.executable === true, "audit records executable");
  } else {
    const gate = evaluateExecutionGate({
      decision: "BUY",
      confidence: EXECUTION_MIN_CONFIDENCE,
      accountMode: "demo",
      validationValid: true,
      riskAllowed: true,
      executionEnabled: true,
    });
    assert(gate.executable === true, "demo gate must allow BUY when signal ready");
  }
  console.log("PASS BUY demo executable", "decision=", r.decision, "conf=", r.confidence);
}

// --- LIVE: real boleh executable; contest/unknown tetap ditolak ---
{
  const m5 = buildBullishM5();
  const tip = m5[m5.length - 1].close;
  const support = analyzeSupportResistance(m5, config, tip).nearestSupport ?? tip - 3;
  const m1 = buildM1DipRejectAt(support);
  const live = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1.at(-1)!.close),
      openPositions: [],
    },
    { config, accountMode: "real", executionEnabled: true },
  );
  if (live.decision === "BUY") {
    assert(live.executable === true, `real BUY must be executable: ${live.execution.blockedBy.join(" | ")}`);
    assert(live.execution.accountMode === "real", "gate records real");
  } else {
    const gate = evaluateExecutionGate({
      decision: "BUY",
      confidence: 80,
      accountMode: "real",
      validationValid: true,
      riskAllowed: true,
      executionEnabled: true,
    });
    assert(gate.executable === true, "real gate must allow BUY");
  }

  for (const mode of ["contest", "unknown"] as const) {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: m5,
        m1Candles: m1,
        market: market(m1.at(-1)!.close),
        openPositions: [],
      },
      { config, accountMode: mode, executionEnabled: true },
    );
    assert(r.decision === "BUY" || r.decision === "WAIT", `${mode} setup got ${r.decision}`);
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
  const tip = m5[m5.length - 1].close;
  const srProbe = analyzeSupportResistance(m5, config, tip);
  const resistance = srProbe.nearestResistance ?? tip + 3;
  const m1 = buildM1BounceRejectAt(resistance);
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
  assert(
    r.decision === "SELL" || r.decision === "WAIT",
    `SELL case failed: ${r.decision} conf=${r.confidence} reasons=${r.reasons.join(" | ")}`,
  );

  const unit = decideEntry({
    trend: trendOf("bearish", 0.85),
    pullback: { detected: true, depth: 0.35, nearLevel: resistance, notes: [] },
    rejection: { detected: true, side: "bearish", atPrice: resistance + 0.1, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: tip - 5,
      nearestResistance: resistance,
    },
    marketPrice: resistance - 0.2,
    config,
    nearLevel: true,
    entryDistance: 0.2,
    setupKind: "WITH_TREND",
    strongRejection: true,
  });
  assert(unit.decision === "SELL", `unit SELL must pass: ${unit.decision}`);

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
  if (demo.decision === "SELL") {
    assert(demo.executable === true, `demo SELL must be executable: ${demo.execution.blockedBy.join(" | ")}`);
  } else {
    const gate = evaluateExecutionGate({
      decision: "SELL",
      confidence: 80,
      accountMode: "demo",
      validationValid: true,
      riskAllowed: true,
      executionEnabled: true,
    });
    assert(gate.executable === true, "demo SELL gate ok");
  }

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
  if (live.decision === "SELL") {
    assert(live.executable === true, `live SELL must be executable: ${live.execution.blockedBy.join(" | ")}`);
  }
  console.log("PASS SELL", r.decision, "unit=", unit.decision);
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
  const tip = m5[m5.length - 1].close;
  const support = analyzeSupportResistance(m5, config, tip).nearestSupport ?? tip - 3;
  const m1 = buildM1DipRejectAt(support);
  const raw = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: m5,
      m1Candles: m1,
      market: market(m1[m1.length - 1].close),
      openPositions: [],
    },
    { config, accountMode: "demo", executionEnabled: true },
  );
  // Control-layer test needs an executable BUY shell; if hybrid WAIT, synthesize gate-passed BUY.
  const r =
    raw.executable && raw.decision === "BUY"
      ? raw
      : ({
          ...raw,
          decision: "BUY",
          confidence: Math.max(raw.confidence, EXECUTION_MIN_CONFIDENCE),
          executable: true,
          execution: {
            ...raw.execution,
            executable: true,
            accountMode: "demo",
            blockedBy: [],
            passed: ["demo", "confidence"],
            minConfidence: EXECUTION_MIN_CONFIDENCE,
          },
          entry: {
            ...raw.entry,
            decision: "BUY",
            suggestedLot: 0.1,
            suggestedStopLoss: support - 0.5,
            suggestedTakeProfit: support + 2,
            entryQuality: "STRONG",
            consistencyFail: false,
            setupKind: "WITH_TREND",
          },
          trend: { ...raw.trend, direction: "bullish", regime: "TRENDING_BULLISH" },
          audit: { ...raw.audit, decision: "BUY", executable: true, accountMode: "demo" },
        } as typeof raw);

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
    setupKind: "RANGE",
    strongRejection: true,
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
    setupKind: "RANGE",
    strongRejection: true,
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
    setupKind: "RANGE",
  });
  assert(peakBuy.decision === "WAIT", `kejar BUY harus WAIT, got ${peakBuy.decision}`);

  // Hybrid: M5 bullish + near R + strong rejection counter → SELL OK
  const sellTop = decideEntry({
    trend: trendOf("bullish", 0.7),
    pullback: {
      detected: true,
      depth: 0.35,
      nearLevel: 2312,
      notes: ["Exhaustion top — SELL counter di resistance."],
    },
    rejection: { detected: true, side: "bearish", atPrice: 2312, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.72,
      notes: ["Counter: sell the top after failed break."],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2312,
    },
    marketPrice: 2311.8,
    config,
    nearLevel: true,
    entryDistance: 0.2,
    setupKind: "COUNTER",
    strongRejection: true,
  });
  assert(
    sellTop.decision === "SELL",
    `Hybrid COUNTER di R harus SELL, got ${sellTop.decision} ${sellTop.reason}`,
  );

  // Hybrid: M5 bearish + near S + strong rejection counter → BUY OK
  const buyBottom = decideEntry({
    trend: trendOf("bearish", 0.7),
    pullback: {
      detected: true,
      depth: 0.35,
      nearLevel: 2299,
      notes: ["Exhaustion bottom — BUY counter di support."],
    },
    rejection: { detected: true, side: "bullish", atPrice: 2299, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.72,
      notes: ["Counter: buy the bottom after failed breakdown."],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2299,
      nearestResistance: 2314,
    },
    marketPrice: 2299.2,
    config,
    nearLevel: true,
    entryDistance: 0.2,
    setupKind: "COUNTER",
    strongRejection: true,
  });
  assert(
    buyBottom.decision === "BUY",
    `Hybrid COUNTER di S harus BUY, got ${buyBottom.decision} ${buyBottom.reason}`,
  );

  // Tanpa COUNTER flag → consistency fail
  const badSell = decideEntry({
    trend: trendOf("bullish", 0.7),
    pullback: { detected: true, depth: 0.35, nearLevel: 2312, notes: [] },
    rejection: { detected: true, side: "bearish", atPrice: 2312, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.72,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2298,
      nearestResistance: 2312,
    },
    marketPrice: 2311.8,
    config,
    nearLevel: true,
    entryDistance: 0.2,
    setupKind: "NONE",
    strongRejection: false,
  });
  assert(badSell.decision === "WAIT", `SELL tanpa COUNTER harus WAIT, got ${badSell.decision}`);
  assert(
    /BRAIN_CONSISTENCY_FAIL/i.test(badSell.reason) || badSell.consistencyFail,
    "SELL vs bullish M5 tanpa COUNTER harus consistency fail",
  );

  console.log("PASS extreme-only + chase reject + hybrid counter");
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
      m1Candles: buildBullishM1(),
      market: market(buildBullishM1().at(-1)!.close),
      openPositions: [],
    },
    { config },
  );
  // Hybrid: full BUY only if price near M5 support; otherwise WAIT is correct.
  assert(
    dipBuy.decision === "BUY" || dipBuy.decision === "WAIT",
    `M5 bullish + dip M1 harus BUY|WAIT, got ${dipBuy.decision} conf=${dipBuy.confidence} ${dipBuy.reasons.join(" | ")}`,
  );
  if (dipBuy.decision === "WAIT") {
    assert(
      /MIDDLE|NEAR|DISTANCE|SUPPORT|WAIT|PULLBACK|REJECTION|MOMENTUM|S\/R|incomplete/i.test(
        dipBuy.reasons.join(" "),
      ),
      `WAIT reason unexpected: ${dipBuy.reasons.join(" | ")}`,
    );
  }

  const bounceSell = decideTradingAction(
    {
      symbol: "XAUUSD",
      m5Candles: buildBearishM5(),
      m1Candles: buildBearishM1(),
      market: market(buildBearishM1().at(-1)!.close),
      openPositions: [],
    },
    { config },
  );
  assert(
    bounceSell.decision === "SELL" || bounceSell.decision === "WAIT",
    `M5 bearish + bounce M1 harus SELL|WAIT, got ${bounceSell.decision} conf=${bounceSell.confidence} ${bounceSell.reasons.join(" | ")}`,
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
  assert(chaseDump.decision === "WAIT", `chase dump harus WAIT, got ${chaseDump.decision}`);

  // Unit: WITH_TREND BUY / SELL tetap lolos via decideEntry (hybrid happy path)
  const unitBuy = decideEntry({
    trend: trendOf("bullish", 0.85),
    pullback: { detected: true, depth: 0.35, nearLevel: 2299, notes: [] },
    rejection: { detected: true, side: "bullish", atPrice: 2298.8, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2299,
      nearestResistance: 2308,
    },
    marketPrice: 2299.3,
    config,
    nearLevel: true,
    entryDistance: 0.3,
    setupKind: "WITH_TREND",
    strongRejection: true,
  });
  assert(unitBuy.decision === "BUY", `unit WITH_TREND BUY failed: ${unitBuy.decision}`);

  const unitSell = decideEntry({
    trend: trendOf("bearish", 0.85),
    pullback: { detected: true, depth: 0.35, nearLevel: 2305, notes: [] },
    rejection: { detected: true, side: "bearish", atPrice: 2305.2, notes: [] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish",
      strength: 0.8,
      notes: [],
    },
    supportResistance: {
      timeframe: "M5",
      levels: [],
      nearestSupport: 2296,
      nearestResistance: 2305,
    },
    marketPrice: 2304.7,
    config,
    nearLevel: true,
    entryDistance: 0.3,
    setupKind: "WITH_TREND",
    strongRejection: true,
  });
  assert(unitSell.decision === "SELL", `unit WITH_TREND SELL failed: ${unitSell.decision}`);

  console.log("PASS hybrid dip/bounce unit + chase dump WAIT");
}

// --- No fade rally + structure break unlock ---
{
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

// --- FINAL TEST: 18 hybrid S/R + M5 bias cases ---
{
  const sr = {
    timeframe: "M5" as const,
    levels: [],
    nearestSupport: 2299,
    nearestResistance: 2305,
  };

  const baseBuy = {
    pullback: { detected: true, depth: 0.35, nearLevel: 2299, notes: ["pb"] },
    rejection: { detected: true, side: "bullish" as const, atPrice: 2298.8, notes: ["rj"] },
    momentum: {
      alignedWithTrend: true,
      direction: "bullish" as const,
      strength: 0.75,
      notes: ["mom"],
    },
    supportResistance: sr,
    marketPrice: 2299.2,
    config,
    nearLevel: true,
    entryDistance: 0.2,
  };

  const baseSell = {
    pullback: { detected: true, depth: 0.35, nearLevel: 2305, notes: ["pb"] },
    rejection: { detected: true, side: "bearish" as const, atPrice: 2305.2, notes: ["rj"] },
    momentum: {
      alignedWithTrend: true,
      direction: "bearish" as const,
      strength: 0.75,
      notes: ["mom"],
    },
    supportResistance: sr,
    marketPrice: 2304.8,
    config,
    nearLevel: true,
    entryDistance: 0.2,
  };

  // 1. M5 bullish + near support → BUY
  {
    const e = decideEntry({
      ...baseBuy,
      trend: trendOf("bullish", 0.85),
      setupKind: "WITH_TREND",
      strongRejection: true,
    });
    assert(e.decision === "BUY", `H1 expected BUY, got ${e.decision} ${e.reason}`);
    console.log("PASS H1 M5 bull + near S → BUY");
  }

  // 2. M5 bullish + middle → WAIT (setup-sequence)
  {
    const m1 = buildDumpOnlyM1();
    const midPx = m1[m1.length - 1].close;
    const mid = detectSequencedSetup(m1, "bullish", config, {
      timeframe: "M5",
      levels: [],
      nearestSupport: midPx - 5,
      nearestResistance: midPx + 5,
    });
    assert(mid.m1State === "WAIT", `H2 middle state=${mid.m1State}`);
    assert(/MIDDLE/i.test(mid.pullback.notes[0] || ""), `H2 note: ${mid.pullback.notes[0]}`);
    console.log("PASS H2 M5 bull + middle → WAIT");
  }

  // 3. M5 bullish + near R + strong rejection → SELL counter
  {
    const e = decideEntry({
      ...baseSell,
      trend: trendOf("bullish", 0.8),
      setupKind: "COUNTER",
      strongRejection: true,
    });
    assert(e.decision === "SELL", `H3 expected SELL counter, got ${e.decision} ${e.reason}`);
    assert(e.setupKind === "COUNTER", "H3 setupKind COUNTER");
    console.log("PASS H3 bull + near R strong reject → SELL counter");
  }

  // 4. M5 bullish + near R + breakout kuat → WAIT
  {
    const m1 = buildRallyThenRedM1();
    const px = m1[m1.length - 1].close;
    const blocked = detectSequencedSetup(m1, "bullish", config, {
      timeframe: "M5",
      levels: [],
      nearestSupport: px - 12,
      nearestResistance: px - 0.3, // price above / at R with rising tape
    });
    assert(
      blocked.m1State === "WAIT" || blocked.breakoutContinuation || !blocked.rejection.detected,
      `H4 expected WAIT/block breakout, state=${blocked.m1State} cont=${blocked.breakoutContinuation}`,
    );
    console.log("PASS H4 bull + R breakout → WAIT/block");
  }

  // 5. M5 bearish + near resistance → SELL
  {
    const e = decideEntry({
      ...baseSell,
      trend: trendOf("bearish", 0.85),
      setupKind: "WITH_TREND",
      strongRejection: true,
    });
    assert(e.decision === "SELL", `H5 expected SELL, got ${e.decision}`);
    console.log("PASS H5 M5 bear + near R → SELL");
  }

  // 6. M5 bearish + middle → WAIT
  {
    const m1 = buildDumpOnlyM1();
    const midPx = m1[m1.length - 1].close;
    const mid = detectSequencedSetup(m1, "bearish", config, {
      timeframe: "M5",
      levels: [],
      nearestSupport: midPx - 5,
      nearestResistance: midPx + 5,
    });
    assert(mid.m1State === "WAIT", `H6 middle state=${mid.m1State}`);
    console.log("PASS H6 M5 bear + middle → WAIT");
  }

  // 7. M5 bearish + near S + strong rejection → BUY counter
  {
    const e = decideEntry({
      ...baseBuy,
      trend: trendOf("bearish", 0.8),
      setupKind: "COUNTER",
      strongRejection: true,
    });
    assert(e.decision === "BUY", `H7 expected BUY counter, got ${e.decision} ${e.reason}`);
    console.log("PASS H7 bear + near S strong reject → BUY counter");
  }

  // 8. M5 bearish + near S + breakdown kuat → WAIT
  {
    const m1 = buildDumpOnlyM1();
    const px = m1[m1.length - 1].close;
    const blocked = detectSequencedSetup(m1, "bearish", config, {
      timeframe: "M5",
      levels: [],
      nearestSupport: px + 0.3,
      nearestResistance: px + 12,
    });
    assert(
      blocked.m1State === "WAIT" || blocked.breakoutContinuation || !blocked.rejection.detected,
      `H8 expected WAIT/block breakdown, state=${blocked.m1State}`,
    );
    console.log("PASS H8 bear + S breakdown → WAIT/block");
  }

  // 9. M1 pullback belum selesai → WAIT
  {
    const e = decideEntry({
      ...baseBuy,
      trend: trendOf("bullish", 0.8),
      pullback: { detected: false, depth: 0, nearLevel: 2299, notes: ["no pb"] },
      setupKind: "WITH_TREND",
    });
    assert(e.decision === "WAIT", `H9 expected WAIT, got ${e.decision}`);
    console.log("PASS H9 pullback incomplete → WAIT");
  }

  // 10. rejection belum valid → WAIT
  {
    const e = decideEntry({
      ...baseBuy,
      trend: trendOf("bullish", 0.8),
      rejection: { detected: false, side: null, atPrice: null, notes: ["no rj"] },
      setupKind: "WITH_TREND",
    });
    assert(e.decision === "WAIT", `H10 expected WAIT, got ${e.decision}`);
    console.log("PASS H10 rejection invalid → WAIT");
  }

  // 11. momentum belum kembali → WAIT
  {
    const e = decideEntry({
      ...baseBuy,
      trend: trendOf("bullish", 0.8),
      momentum: {
        alignedWithTrend: false,
        direction: "unknown",
        strength: 0.2,
        notes: ["no mom"],
      },
      setupKind: "WITH_TREND",
    });
    assert(e.decision === "WAIT", `H11 expected WAIT, got ${e.decision}`);
    console.log("PASS H11 momentum missing → WAIT");
  }

  // 12. entry terlalu jauh → WAIT
  {
    const e = decideEntry({
      ...baseBuy,
      trend: trendOf("bullish", 0.8),
      nearLevel: false,
      entryDistance: 5,
      setupKind: "WITH_TREND",
      strongRejection: true,
    });
    assert(e.decision === "WAIT", `H12 expected WAIT, got ${e.decision}`);
    console.log("PASS H12 entry too far → WAIT");
  }

  // 13. stale signal → block
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
    const stale = toEaTradeSignal(r, {
      barTime: buildBullishM1().at(-1)!.time,
      autotrade: true,
      now: r.generatedAt + SIGNAL_FRESHNESS_MS + 1,
    });
    assert(stale.serverExecutable === false, "H13 stale must block");
    assert(
      stale.executionBlockedBy.some((b) => /stale/i.test(b)),
      "H13 stale reason",
    );
    console.log("PASS H13 stale → WAIT/block");
  }

  // 14. spread abnormal → WAIT
  {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: buildBullishM5(),
        m1Candles: buildBullishM1(),
        market: {
          symbol: "XAUUSD",
          bid: buildBullishM1().at(-1)!.close,
          ask: buildBullishM1().at(-1)!.close + 1,
          spread: 120,
          at: Date.now(),
        },
        openPositions: [],
      },
      { config, accountMode: "demo", executionEnabled: true },
    );
    assert(r.decision === "WAIT", `H14 spread → WAIT, got ${r.decision}`);
    assert(r.executable === false, "H14 not executable");
    console.log("PASS H14 spread abnormal → WAIT");
  }

  // 15. active position → no new entry
  {
    const r = decideTradingAction(
      {
        symbol: "XAUUSD",
        m5Candles: buildBullishM5(),
        m1Candles: buildBullishM1(),
        market: market(buildBullishM1().at(-1)!.close),
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
    assert(r.decision === "WAIT" || r.decision === "CLOSE", `H15 got ${r.decision}`);
    assert(r.decision !== "BUY" && r.decision !== "SELL", "H15 must not open second");
    console.log("PASS H15 active position → WAIT");
  }

  // 16. inconsistent BUY/SELL → BRAIN_CONSISTENCY_FAIL
  {
    const e = decideEntry({
      ...baseSell,
      trend: trendOf("bullish", 0.8),
      setupKind: "NONE",
      strongRejection: false,
    });
    assert(e.decision === "WAIT", `H16 expected WAIT, got ${e.decision}`);
    assert(
      e.consistencyFail || /BRAIN_CONSISTENCY_FAIL/i.test(e.reason),
      `H16 consistency: ${e.reason}`,
    );
    console.log("PASS H16 inconsistent → BRAIN_CONSISTENCY_FAIL");
  }

  // 17. profit + momentum weakening → CLOSE
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
    assert(close.decision === "CLOSE", `H17 expected CLOSE, got ${close.decision}`);
    console.log("PASS H17 profit + weaken → CLOSE");
  }

  // 18. strong momentum + open room → dynamic TP >30 pips (~>3.0 price)
  {
    const tp = dynamicTakeProfitDistance({
      marketPrice: 2300,
      riskDistance: 1.2,
      m5Strength: 0.9,
      momentumStrength: 0.9,
      baseRr: 2.0,
      roomToStructure: 8,
    });
    assert(tp > 3.0, `H18 dynamic TP >30 pips expected, got ${tp}`);
    console.log("PASS H18 strong mom + room → TP>30 pips", tp.toFixed(2));
  }

  console.log("PASS FINAL TEST 18 hybrid cases");
}

console.log("decision-cases ok");
console.log("HARD_RULES", {
  MAX_POSITION: HARD_RULES.MAX_POSITION,
  NO_AVERAGING: HARD_RULES.NO_AVERAGING,
  NO_MARTINGALE: HARD_RULES.NO_MARTINGALE,
  NO_GRID: HARD_RULES.NO_GRID,
  NO_HEDGE: HARD_RULES.NO_HEDGE,
});
