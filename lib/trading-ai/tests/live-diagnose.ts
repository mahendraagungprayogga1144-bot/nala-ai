/**
 * Diagnosa kenapa Brain masih WAIT pada feed MT5 yang sedang berjalan.
 * Read-only: tidak menulis apa pun, tidak mengirim order.
 *
 * Run: npx tsx --env-file=.env.local lib/trading-ai/tests/live-diagnose.ts [SYMBOL]
 */

import { decideTradingAction } from "../decide";
import { DEFAULT_TRADING_AI_CONFIG, EXECUTION_MIN_CONFIDENCE } from "../config";
import type { Candle, SymbolCode } from "../types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env (.env.local).");

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function fetchCandles(
  userId: string,
  symbol: string,
  timeframe: "M1" | "M5",
): Promise<Candle[]> {
  const rows = await rest<
    { bar_time: number; open: number; high: number; low: number; close: number }[]
  >(
    `trading_ai_candles?select=bar_time,open,high,low,close&user_id=eq.${userId}` +
      `&symbol=eq.${symbol}&timeframe=eq.${timeframe}&order=bar_time.desc&limit=200`,
  );
  return rows
    .map((r) => ({
      time: Number(r.bar_time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    }))
    .reverse();
}

async function main() {
  const symbol = (process.argv[2] || "XAUUSD").toUpperCase() as SymbolCode;

  // nullslast: kunci yang belum pernah dipakai jangan menang urutan.
  const keys = await rest<{ user_id: string; last_seen_at: string | null }[]>(
    "trading_ai_bridge_keys?select=user_id,last_seen_at&revoked_at=is.null" +
      "&order=last_seen_at.desc.nullslast&limit=1",
  );
  const userId = keys[0]?.user_id;
  if (!userId) throw new Error("Tidak ada bridge key aktif.");
  console.log(`feed user=${userId.slice(0, 8)}… last_seen=${keys[0].last_seen_at}`);

  const [m5, m1] = await Promise.all([
    fetchCandles(userId, symbol, "M5"),
    fetchCandles(userId, symbol, "M1"),
  ]);
  console.log(`candles: M5=${m5.length} M1=${m1.length}`);
  if (!m5.length || !m1.length) throw new Error("Feed kosong — pastikan GercepCandlePush jalan.");

  // bar_time memakai jam server broker, jadi tidak bisa dibandingkan dengan jam lokal.
  // updated_at adalah waktu tulis sungguhan — itu yang dipakai mengukur basi.
  const [latest] = await rest<{ updated_at: string }[]>(
    `trading_ai_candles?select=updated_at&symbol=eq.${symbol}` +
      "&timeframe=eq.M1&order=bar_time.desc&limit=1",
  );
  const ageMin = latest ? (Date.now() - Date.parse(latest.updated_at)) / 60000 : Infinity;
  console.log(`ingest terakhir: ${latest?.updated_at ?? "?"} (${ageMin.toFixed(0)} menit lalu)`);
  if (ageMin > 5) {
    console.log(
      `WARNING feed basi ${ageMin.toFixed(0)} menit — GercepCandlePush tidak mengirim.\n` +
        "         Ingat: satu chart MT5 hanya bisa menjalankan satu EA.\n" +
        "         Butuh chart XAUUSD terpisah untuk CandlePush dan TradeExecutor.",
    );
  }

  // Spread tidak tersimpan di feed, jadi harus diberikan. Nilai ini menentukan
  // lolos/tidaknya risk filter, jadi jangan diam-diam pakai angka optimistis.
  const spread = Number(process.argv[3] ?? 20);
  console.log(`spread diasumsikan: ${spread} points (maxSpreadPoints=${DEFAULT_TRADING_AI_CONFIG.risk.maxSpreadPoints})`);

  const bid = m1[m1.length - 1].close;
  const result = decideTradingAction(
    {
      symbol,
      m5Candles: m5,
      m1Candles: m1,
      market: { symbol, bid, ask: bid + 0.2, spread, at: Date.now() },
      openPositions: [],
    },
    { accountMode: "demo", executionEnabled: true },
  );

  console.log(
    `\ndecision=${result.decision} confidence=${result.confidence} executable=${result.executable}`,
  );
  console.log(`M5 trend=${result.trend.direction} strength=${result.trend.strength.toFixed(2)}`);
  console.log(
    `support=${result.supportResistance.nearestSupport} resistance=${result.supportResistance.nearestResistance}`,
  );

  console.log("\n--- confidence features ---");
  for (const f of result.validation.breakdown.features) {
    const pts = f.passed ? f.points : 0;
    console.log(`${f.passed ? "OK  " : "MISS"} ${String(pts).padStart(3)}pts  ${f.label}`);
    console.log(`             ${f.detail}`);
  }
  console.log(`\ntotal=${result.confidence} / butuh ${EXECUTION_MIN_CONFIDENCE} untuk eksekusi`);

  console.log("\n--- setup sequence ---");
  console.log(`pullback : ${result.pullback.detected}  ${result.pullback.notes[0] ?? ""}`);
  console.log(`rejection: ${result.rejection.detected}  ${result.rejection.notes[0] ?? ""}`);
  console.log(`momentum : ${result.momentum.alignedWithTrend}  ${result.momentum.notes[0] ?? ""}`);

  console.log("\n--- kenapa tidak entry ---");
  for (const r of result.reasons.slice(0, 6)) console.log(`- ${r}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
