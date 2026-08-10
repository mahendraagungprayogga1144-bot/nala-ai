/**
 * Bandingkan basis depth pullback ("level" vs "impulse") pada data candle nyata.
 * Read-only: tidak menulis DB, tidak mengirim order.
 *
 * Run: npx tsx --env-file=.env.local lib/trading-ai/tests/backtest-compare.ts [SYMBOL]
 */

import { runBacktest } from "../backtest/backtest-engine";
import { DEFAULT_TRADING_AI_CONFIG } from "../config";
import type { Candle, SymbolCode } from "../types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env (.env.local).");

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchAllCandles(symbol: string, timeframe: "M1" | "M5"): Promise<Candle[]> {
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

function hours(from: number, to: number) {
  return ((to - from) / 3600).toFixed(1);
}

async function main() {
  const symbol = (process.argv[2] || "XAUUSD").toUpperCase() as SymbolCode;

  const [m5, m1] = await Promise.all([
    fetchAllCandles(symbol, "M5"),
    fetchAllCandles(symbol, "M1"),
  ]);
  console.log(`candles: M5=${m5.length} M1=${m1.length}`);
  if (m1.length) {
    console.log(
      `M1 range: ${new Date(m1[0].time * 1000).toISOString()} → ` +
        `${new Date(m1[m1.length - 1].time * 1000).toISOString()} (${hours(m1[0].time, m1[m1.length - 1].time)} jam)`,
    );
  }

  for (const basis of ["level", "impulse"] as const) {
    const result = runBacktest({
      symbol,
      m5Candles: m5,
      m1Candles: m1,
      config: {
        ...DEFAULT_TRADING_AI_CONFIG,
        brain: { ...DEFAULT_TRADING_AI_CONFIG.brain, pullbackDepthBasis: basis },
      },
    });

    const closed = result.trades.length;
    const winRate = closed ? ((result.wins / closed) * 100).toFixed(0) : "n/a";
    console.log(`\n=== basis="${basis}" ===`);
    console.log(
      `trades=${closed} wins=${result.wins} losses=${result.losses} ` +
        `winRate=${winRate}% pnl=${result.totalPnl.toFixed(2)} maxDD=${result.maxDrawdown.toFixed(2)}`,
    );
    for (const n of result.notes.filter((n) => n.startsWith("Signals") || n.startsWith("Steps"))) {
      console.log(`  ${n}`);
    }
  }

  console.log(
    "\nCatatan: sampel kecil tidak cukup untuk menyimpulkan performa. " +
      "Yang bisa dibaca dari sini hanya frekuensi sinyal, bukan profitabilitas.",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
