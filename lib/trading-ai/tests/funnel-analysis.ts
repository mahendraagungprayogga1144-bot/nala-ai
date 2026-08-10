/**
 * Corong setup: di tahap mana Brain paling sering gugur?
 * Memutar ulang tiap bar M1 yang tersedia dan menghitung berapa kali
 * tiap kaki sekuens terpenuhi. Read-only.
 *
 * Run: npx tsx --env-file=.env.local lib/trading-ai/tests/funnel-analysis.ts [SYMBOL]
 */

import { decideTradingAction } from "../decide";
import { DEFAULT_TRADING_AI_CONFIG, EXECUTION_MIN_CONFIDENCE } from "../config";
import type { Candle, SymbolCode } from "../types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env (.env.local).");

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchAll(symbol: string, timeframe: "M1" | "M5"): Promise<Candle[]> {
  const out: Candle[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(
      `${url}/rest/v1/trading_ai_candles?select=bar_time,open,high,low,close` +
        `&symbol=eq.${symbol}&timeframe=eq.${timeframe}` +
        `&order=bar_time.asc&offset=${offset}&limit=${pageSize}`,
      { headers },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Record<string, number>[];
    for (const r of rows) {
      out.push({
        time: Number(r.bar_time),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
      });
    }
    if (rows.length < pageSize) break;
  }
  return out;
}

function upperBoundTime(candles: Candle[], t: number) {
  let lo = 0;
  let hi = candles.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function pct(n: number, total: number) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : "0%";
}

async function main() {
  const symbol = (process.argv[2] || "XAUUSD").toUpperCase() as SymbolCode;
  const [m5, m1] = await Promise.all([fetchAll(symbol, "M5"), fetchAll(symbol, "M1")]);
  console.log(`candles: M5=${m5.length} M1=${m1.length}`);

  // Kontinuitas: berapa banyak lompatan waktu di data M1.
  let gaps = 0;
  let biggestGapMin = 0;
  for (let i = 1; i < m1.length; i++) {
    const d = (m1[i].time - m1[i - 1].time) / 60;
    if (d > 1.5) {
      gaps++;
      biggestGapMin = Math.max(biggestGapMin, d);
    }
  }
  const spanMin = m1.length ? (m1[m1.length - 1].time - m1[0].time) / 60 : 0;
  console.log(
    `kontinuitas M1: ${m1.length} bar untuk rentang ${spanMin.toFixed(0)} menit ` +
      `(${pct(m1.length, spanMin)} terisi), ${gaps} lompatan, terbesar ${biggestGapMin.toFixed(0)} menit`,
  );

  const config = DEFAULT_TRADING_AI_CONFIG;
  const startIdx = Math.max(config.brain.minM1Candles, 10);
  const spread = Number(process.argv[3] ?? 20);
  console.log(
    `spread diasumsikan: ${spread} points (maxSpreadPoints=${config.risk.maxSpreadPoints})` +
      (spread > config.risk.maxSpreadPoints ? "  <-- DI ATAS BATAS: semua entry diblokir" : ""),
  );

  let steps = 0;
  let biasClear = 0;
  let pullback = 0;
  let rejection = 0;
  let momentum = 0;
  let entrySignal = 0;
  let aboveThreshold = 0;
  let maxConf = 0;
  const confBuckets = new Map<string, number>();

  for (let i = startIdx; i < m1.length; i++) {
    const bar = m1[i];
    const m5End = upperBoundTime(m5, bar.time);
    if (m5End < config.brain.minM5Candles - 1) continue;

    const r = decideTradingAction({
      symbol,
      m5Candles: m5.slice(Math.max(0, m5End - 119), m5End + 1),
      m1Candles: m1.slice(Math.max(0, i - 119), i + 1),
      market: { symbol, bid: bar.close, ask: bar.close + 0.2, spread, at: bar.time * 1000 },
      openPositions: [],
    });

    steps++;
    if (r.trend.direction === "bullish" || r.trend.direction === "bearish") biasClear++;
    if (r.pullback.detected) pullback++;
    if (r.rejection.detected) rejection++;
    if (r.momentum.alignedWithTrend) momentum++;
    if (r.decision === "BUY" || r.decision === "SELL") entrySignal++;
    if (r.confidence >= EXECUTION_MIN_CONFIDENCE) aboveThreshold++;
    maxConf = Math.max(maxConf, r.confidence);

    const bucket = `${Math.floor(r.confidence / 20) * 20}-${Math.floor(r.confidence / 20) * 20 + 19}`;
    confBuckets.set(bucket, (confBuckets.get(bucket) ?? 0) + 1);
  }

  console.log(`\n=== corong setup (${steps} bar dievaluasi) ===`);
  console.log(`M5 bias jelas      : ${biasClear.toString().padStart(4)}  ${pct(biasClear, steps)}`);
  console.log(`+ M1 pullback      : ${pullback.toString().padStart(4)}  ${pct(pullback, steps)}`);
  console.log(`+ M1 rejection     : ${rejection.toString().padStart(4)}  ${pct(rejection, steps)}`);
  console.log(`+ M1 momentum      : ${momentum.toString().padStart(4)}  ${pct(momentum, steps)}`);
  console.log(`= sinyal BUY/SELL  : ${entrySignal.toString().padStart(4)}  ${pct(entrySignal, steps)}`);
  console.log(`conf >= ${EXECUTION_MIN_CONFIDENCE}         : ${aboveThreshold.toString().padStart(4)}  ${pct(aboveThreshold, steps)}`);
  console.log(`confidence tertinggi: ${maxConf}`);

  console.log("\n=== sebaran confidence ===");
  for (const b of [...confBuckets.keys()].sort((a, c) => Number(a.split("-")[0]) - Number(c.split("-")[0]))) {
    const n = confBuckets.get(b)!;
    console.log(`${b.padStart(6)} : ${"█".repeat(Math.max(1, Math.round((n / steps) * 40)))} ${n} (${pct(n, steps)})`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
