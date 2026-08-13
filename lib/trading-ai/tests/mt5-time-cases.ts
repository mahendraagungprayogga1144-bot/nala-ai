/**
 * Run: npx tsx lib/trading-ai/tests/mt5-time-cases.ts
 */

import {
  estimateBrokerNowSec,
  formatGmtOffsetLabel,
  formatMt5DateTime,
  formatMt5Time,
} from "../mt5-time";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 2026-08-11 21:55:00 as MT5 TimeToString components (UTC getters).
const sample = Date.UTC(2026, 7, 11, 21, 55, 0) / 1000;

assert(formatMt5Time(sample) === "11 Agu, 21.55", `fmt time: ${formatMt5Time(sample)}`);
assert(
  formatMt5DateTime(sample) === "11 Agu 21:55:00",
  `fmt datetime: ${formatMt5DateTime(sample)}`,
);
assert(formatMt5Time(null) === "—", "null");
assert(formatGmtOffsetLabel(10800) === "GMT+3", "gmt+3");
assert(formatGmtOffsetLabel(-18000) === "GMT-5", "gmt-5");

const now = 1_800_000_000_000;
const broker = 1_700_000_000;
assert(
  estimateBrokerNowSec(broker, now - 15_000, now) === broker + 15,
  "estimate advances with wall clock",
);
assert(estimateBrokerNowSec(null, now) === null, "null broker");

console.log("PASS mt5-time-cases");
