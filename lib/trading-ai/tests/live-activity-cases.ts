/**
 * Run: npx tsx lib/trading-ai/tests/live-activity-cases.ts
 */

import { buildOpenHint, type LiveOrderRow, type LiveSignalSnapshot } from "../live-activity";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base: LiveSignalSnapshot = {
  signalId: "sig_1",
  decision: "WAIT",
  confidence: 26,
  spread: 30,
  m5Bias: "bullish",
  m1Direction: "bullish",
  serverExecutable: false,
  accountMode: "demo",
  accountLogin: 1,
  autotrade: true,
  liveEnable: false,
  emergencyStop: false,
  at: new Date().toISOString(),
};

assert(/WAIT/.test(buildOpenHint(base, null)), "wait hint");
assert(
  /AUTO OFF/.test(buildOpenHint({ ...base, autotrade: false }, null)) ||
    /OFF/.test(buildOpenHint({ ...base, autotrade: false }, null)),
  "auto off",
);
assert(
  /EMERGENCY/.test(buildOpenHint({ ...base, emergencyStop: true }, null)),
  "estop",
);
assert(
  /LIVE EXECUTION DISABLED/.test(
    buildOpenHint({ ...base, accountMode: "real", liveEnable: false }, null),
  ),
  "real without live enable",
);
assert(
  /siap dieksekusi/.test(
    buildOpenHint({ ...base, decision: "BUY", serverExecutable: true, confidence: 100 }, null),
  ),
  "buy ready",
);

const filled: LiveOrderRow = {
  id: 1,
  signalId: "sig_buy",
  status: "FILLED",
  direction: "BUY",
  lot: 0.1,
  ticket: 123,
  entryPrice: 4376.9,
  spread: 20,
  confidence: 100,
  errorCode: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
};
assert(/BUY/.test(buildOpenHint(base, filled)), "filled hint");

import { buildQuantStats, activeCycleStage } from "../quant-stats";
const qs = buildQuantStats([
  filled,
  { ...filled, id: 2, status: "CLOSE_FAILED", errorMessage: "unknown retcode 0" },
]);
assert(qs.fills === 1 && qs.closeFailed === 1, "quant stats counts");
assert(activeCycleStage({
  feedOk: true,
  decision: "WAIT",
  confidence: 31,
  minConfidence: 65,
  serverExecutable: false,
  lastStatus: null,
}) === "detect", "wait cycle = detect");

console.log("PASS live-activity-cases");
