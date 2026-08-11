/**
 * MT5 read-only candle helpers. Brain rules unchanged.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candle, SymbolCode, Timeframe } from "./types";

export type BridgeKeyRow = {
  id: string;
  api_key: string;
  label: string;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type CandleFeedStatus = {
  symbol: SymbolCode;
  m5Count: number;
  m1Count: number;
  m5LastTime: number | null;
  m1LastTime: number | null;
};

export function generateBridgeApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `gea_${hex}`;
}

export async function loadCandles(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    symbol?: SymbolCode;
    timeframe: Extract<Timeframe, "M1" | "M5">;
    limit?: number;
  },
): Promise<Candle[]> {
  const limit = opts.limit ?? 200;
  const { data, error } = await supabase
    .from("trading_ai_candles")
    .select("bar_time, open, high, low, close, volume")
    .eq("user_id", opts.userId)
    .eq("symbol", opts.symbol ?? "XAUUSD")
    .eq("timeframe", opts.timeframe)
    .order("bar_time", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return data
    .map((r) => ({
      time: Number(r.bar_time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: r.volume != null ? Number(r.volume) : undefined,
    }))
    .reverse();
}

/**
 * Status feed ringan untuk dashboard. Tidak memuat 500 candle penuh —
 * dulu itu yang membuat SSR hang lama dan UI terlihat "loading terus".
 * Trading Brain tetap memakai loadCandles() penuh saat decide.
 */
async function timeframeFeedStatus(
  supabase: SupabaseClient,
  userId: string,
  symbol: SymbolCode,
  timeframe: Extract<Timeframe, "M1" | "M5">,
): Promise<{ count: number; lastTime: number | null }> {
  const [countRes, lastRes] = await Promise.all([
    supabase
      .from("trading_ai_candles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .eq("timeframe", timeframe),
    supabase
      .from("trading_ai_candles")
      .select("bar_time")
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .order("bar_time", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    count: countRes.count ?? 0,
    lastTime: lastRes.data?.bar_time != null ? Number(lastRes.data.bar_time) : null,
  };
}

export async function getCandleFeedStatus(
  supabase: SupabaseClient,
  userId: string,
  symbol: SymbolCode = "XAUUSD",
): Promise<CandleFeedStatus> {
  const [m5, m1] = await Promise.all([
    timeframeFeedStatus(supabase, userId, symbol, "M5"),
    timeframeFeedStatus(supabase, userId, symbol, "M1"),
  ]);
  return {
    symbol,
    m5Count: m5.count,
    m1Count: m1.count,
    m5LastTime: m5.lastTime,
    m1LastTime: m1.lastTime,
  };
}
