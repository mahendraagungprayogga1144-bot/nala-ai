/**
 * Account-agnostic execution gates — DEMO + REAL.
 * Run: npx tsx lib/trading-ai/tests/account-execution-cases.ts
 */

import {
  buildAccountExecutionStatus,
  evaluateExecutionGate,
  evaluateRuntimeControl,
  DEFAULT_EXECUTION_CONTROL,
  isSignalFresh,
  SIGNAL_FRESHNESS_MS,
  resolveTradingSymbol,
  checkMargin,
  checkSpread,
  checkPositionLimit,
  checkMarketSession,
  HARD_RULES,
  DEFAULT_TRADING_AI_CONFIG,
  mergeTradingAiConfig,
} from "../index";
import type { MarketSnapshot, OpenPosition } from "../types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const config = mergeTradingAiConfig(DEFAULT_TRADING_AI_CONFIG);
const on = { ...DEFAULT_EXECUTION_CONTROL, autotradeEnabled: true };

assert(HARD_RULES.ALLOW_LIVE_EXECUTION === true, "product allows REAL");

// 1. DEMO + Auto Execution ON → order allowed (gate + runtime)
{
  const gate = evaluateExecutionGate({
    decision: "BUY",
    confidence: 80,
    accountMode: "demo",
    validationValid: true,
    riskAllowed: true,
    executionEnabled: true,
  });
  assert(gate.executable === true, `T1 demo gate: ${gate.blockedBy.join(" | ")}`);
  const rt = evaluateRuntimeControl({
    decision: "BUY",
    state: on,
    accountMode: "demo",
  });
  assert(rt.allowed === true, `T1 demo runtime: ${rt.blockedBy.join(" | ")}`);
  const st = buildAccountExecutionStatus("demo", {
    autotrade: true,
    liveEnable: false,
    emergencyStop: false,
    mt5Connected: true,
    riskAllowed: true,
    serverExecutable: true,
  });
  assert(st.executionLabel === "READY", `T1 status READY got ${st.executionLabel}`);
  assert(/DEMO ACCOUNT — AUTO EXECUTION AVAILABLE/.test(st.banner), `T1 banner: ${st.banner}`);
  console.log("PASS T1 DEMO + auto ON → allowed");
}

// 2. DEMO + Auto Execution OFF → no order
{
  const rt = evaluateRuntimeControl({
    decision: "BUY",
    state: { ...on, autotradeEnabled: false },
    accountMode: "demo",
  });
  assert(rt.allowed === false, "T2 demo auto OFF must block");
  console.log("PASS T2 DEMO + auto OFF → blocked");
}

// 3. REAL + Live Enable OFF → no order
{
  const rt = evaluateRuntimeControl({
    decision: "BUY",
    state: { ...on, liveEnable: false },
    accountMode: "real",
  });
  assert(rt.allowed === false, "T3 REAL liveEnable OFF must block");
  assert(
    rt.blockedBy.some((b) => /LIVE EXECUTION DISABLED/i.test(b)),
    `T3 message: ${rt.blockedBy.join(" | ")}`,
  );
  const st = buildAccountExecutionStatus("real", {
    autotrade: true,
    liveEnable: false,
    emergencyStop: false,
    mt5Connected: true,
    riskAllowed: true,
    serverExecutable: true,
  });
  assert(st.executionLabel === "BLOCKED", "T3 EXECUTION BLOCKED");
  assert(/REAL ACCOUNT DETECTED — LIVE EXECUTION DISABLED/.test(st.banner), st.banner);
  console.log("PASS T3 REAL + LIVE ENABLE OFF → blocked");
}

// 4. REAL + Live Enable ON + Risk PASS → order allowed
{
  const gate = evaluateExecutionGate({
    decision: "SELL",
    confidence: 80,
    accountMode: "real",
    validationValid: true,
    riskAllowed: true,
    executionEnabled: true,
  });
  assert(gate.executable === true, `T4 real gate: ${gate.blockedBy.join(" | ")}`);
  const rt = evaluateRuntimeControl({
    decision: "SELL",
    state: { ...on, liveEnable: true },
    accountMode: "real",
  });
  assert(rt.allowed === true, `T4 real runtime: ${rt.blockedBy.join(" | ")}`);
  console.log("PASS T4 REAL + LIVE ENABLE ON + risk PASS → allowed");
}

// 5. REAL + Live Enable ON + Risk FAIL → no order
{
  const gate = evaluateExecutionGate({
    decision: "BUY",
    confidence: 80,
    accountMode: "real",
    validationValid: true,
    riskAllowed: false,
    executionEnabled: true,
  });
  assert(gate.executable === false, "T5 risk fail must block gate");
  console.log("PASS T5 REAL + risk FAIL → blocked");
}

// 6. wrong symbol → block
{
  const bad = resolveTradingSymbol("EURUSD");
  assert(bad.ok === false, "T6 EURUSD must fail");
  const good = resolveTradingSymbol("XAUUSDm");
  assert(good.ok === true && good.symbol === "XAUUSD", "T6 XAUUSDm ok");
  console.log("PASS T6 wrong symbol → block");
}

// 7. spread abnormal → block
{
  const market: MarketSnapshot = {
    symbol: "XAUUSD",
    bid: 2300,
    ask: 2301.5,
    spread: 150,
    at: Date.now(),
  };
  const spread = checkSpread(market, config);
  assert(spread.allowed === false, `T7 spread must block: ${spread.reasons.join(" | ")}`);
  console.log("PASS T7 spread abnormal → block");
}

// 8. stale signal → block
{
  assert(!isSignalFresh(Date.now() - (SIGNAL_FRESHNESS_MS + 1)), "T8 stale");
  assert(isSignalFresh(Date.now()), "T8 fresh");
  console.log("PASS T8 stale signal → block");
}

// 9. margin insufficient → block
{
  const m = checkMargin({ freeMargin: 5, requiredMargin: 100, lot: 0.1 });
  assert(m.allowed === false, `T9 margin: ${m.reasons.join(" | ")}`);
  const ok = checkMargin({ freeMargin: 500, requiredMargin: 100, lot: 0.1 });
  assert(ok.allowed === true, "T9 margin ok");
  console.log("PASS T9 margin insufficient → block");
}

// 10. active position exists → block
{
  const pos: OpenPosition[] = [
    {
      id: "1",
      symbol: "XAUUSD",
      side: "BUY",
      lot: 0.1,
      openPrice: 2300,
      stopLoss: null,
      takeProfit: null,
      openedAt: Date.now(),
      floatingPnl: 0,
    },
  ];
  const lim = checkPositionLimit(pos, "BUY", config);
  assert(lim.allowed === false, "T10 max position");
  console.log("PASS T10 active position → block");
}

// 11. emergency stop → block
{
  const rt = evaluateRuntimeControl({
    decision: "BUY",
    state: { ...on, liveEnable: true, emergencyStop: true },
    accountMode: "real",
  });
  assert(rt.allowed === false, "T11 estop");
  assert(rt.blockedBy.some((b) => /EMERGENCY STOP/i.test(b)), "T11 estop reason");
  console.log("PASS T11 emergency stop → block");
}

// Market session sanity
{
  const sat = checkMarketSession(Math.floor(Date.UTC(2026, 7, 22, 12) / 1000)); // Sat
  assert(sat.allowed === false, "Saturday closed");
}

console.log("PASS account-execution-cases (11)");
