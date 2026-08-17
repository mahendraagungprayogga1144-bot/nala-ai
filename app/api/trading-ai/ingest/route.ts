import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTradingSymbol } from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InCandle = {
  time?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
};

type Body = {
  symbol?: unknown;
  timeframe?: unknown;
  candles?: unknown;
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return (req.headers.get("x-gercep-key") || "").trim();
}

/**
 * MT5 EA → Gercep candle ingest (read-only).
 * Auth: Authorization: Bearer <gea_...>
 * Body: { symbol, timeframe: "M1"|"M5", candles: [{time,open,high,low,close,volume?}] }
 */
export async function POST(request: Request) {
  const apiKey = bearer(request);
  if (!apiKey || !apiKey.startsWith("gea_")) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server belum dikonfigurasi (service role)." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const symbol = normalizeTradingSymbol(
    typeof body.symbol === "string" && body.symbol.trim() ? body.symbol : "XAUUSD",
  );
  const timeframe = typeof body.timeframe === "string" ? body.timeframe.trim().toUpperCase() : "";
  if (timeframe !== "M1" && timeframe !== "M5") {
    return NextResponse.json({ error: 'timeframe must be "M1" or "M5"' }, { status: 400 });
  }

  if (!Array.isArray(body.candles) || !body.candles.length) {
    return NextResponse.json({ error: "candles[] required" }, { status: 400 });
  }
  if (body.candles.length > 500) {
    return NextResponse.json({ error: "Max 500 candles per request" }, { status: 400 });
  }

  const { data: keyRow, error: keyErr } = await admin
    .from("trading_ai_bridge_keys")
    .select("id, user_id, revoked_at")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (keyErr) {
    // Table may not exist yet
    return NextResponse.json(
      { error: keyErr.message || "Bridge table error — jalankan migrasi SQL Trading AI." },
      { status: 500 },
    );
  }
  if (!keyRow || keyRow.revoked_at) {
    return NextResponse.json({ error: "API key tidak valid / sudah dicabut" }, { status: 401 });
  }

  const rows: Record<string, unknown>[] = [];
  for (const raw of body.candles as InCandle[]) {
    const time = num(raw.time);
    const open = num(raw.open);
    const high = num(raw.high);
    const low = num(raw.low);
    const close = num(raw.close);
    const volume = raw.volume == null ? null : num(raw.volume);
    if (time == null || open == null || high == null || low == null || close == null) continue;
    if (high < low) continue;
    rows.push({
      user_id: keyRow.user_id,
      symbol,
      timeframe,
      bar_time: Math.floor(time),
      open,
      high,
      low,
      close,
      volume,
      source: "mt5_ea",
      updated_at: new Date().toISOString(),
    });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No valid candles in payload" }, { status: 400 });
  }

  const { error: upErr } = await admin.from("trading_ai_candles").upsert(rows, {
    onConflict: "user_id,symbol,timeframe,bar_time",
  });

  if (upErr) {
    return NextResponse.json({ error: upErr.message || "Upsert gagal" }, { status: 500 });
  }

  await admin
    .from("trading_ai_bridge_keys")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return NextResponse.json({
    ok: true,
    symbol,
    timeframe,
    upserted: rows.length,
    liveTrading: false,
    note: "Read-only ingest. Brain rules unchanged. No orders.",
  });
}

/** Simple health for EA setup check. */
export async function GET(request: Request) {
  const apiKey = bearer(request);
  if (!apiKey) {
    return NextResponse.json({
      service: "trading-ai-ingest",
      mode: "read_only",
      auth: "Bearer gea_...",
    });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const { data: keyRow } = await admin
    .from("trading_ai_bridge_keys")
    .select("id, last_seen_at, revoked_at, label")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!keyRow || keyRow.revoked_at) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    label: keyRow.label,
    last_seen_at: keyRow.last_seen_at,
    liveTrading: false,
  });
}
