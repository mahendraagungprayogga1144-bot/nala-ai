import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideTradingAction,
  DEFAULT_TRADING_AI_CONFIG,
  HARD_RULES,
  isEaSignalExecutionEnabled,
  loadCandles,
  toEaTradeSignal,
  TRADING_AI_VERSION,
  type OpenPosition,
  type SymbolCode,
} from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return (req.headers.get("x-gercep-key") || "").trim();
}

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * MT5 EA polls Trading Brain signal.
 * Auth: Bearer gea_...
 *
 * Query:
 *   symbol=XAUUSD
 *   bid, ask, spread (optional — defaults from last M1 close)
 *   open_side=BUY|SELL|none
 *   open_price, open_lot, open_ticket, balance (optional)
 *
 * Server never places orders. EA may OrderSend only when:
 *   - eaMayExecute (env TRADING_AI_EA_SIGNALS=1)
 *   - EA InpAllowTrading=true
 *   - account is DEMO (EA hard rule)
 */
export async function GET(request: Request) {
  const apiKey = bearer(request);
  if (!apiKey) {
    return NextResponse.json({
      service: "trading-ai-signal",
      version: TRADING_AI_VERSION,
      auth: "Bearer gea_...",
      serverOrders: false,
      hardRules: {
        MAX_POSITION: HARD_RULES.MAX_POSITION,
        NO_AVERAGING: HARD_RULES.NO_AVERAGING,
        NO_MARTINGALE: HARD_RULES.NO_MARTINGALE,
        NO_GRID: HARD_RULES.NO_GRID,
        NO_HEDGE: HARD_RULES.NO_HEDGE,
      },
      eaSignalsEnv: isEaSignalExecutionEnabled(),
      note: "GET with API key to receive Brain decision for EA.",
    });
  }

  if (!apiKey.startsWith("gea_")) {
    return NextResponse.json({ ok: false, error: "Invalid API key" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server belum dikonfigurasi (service role)." }, { status: 503 });
  }

  const { data: keyRow, error: keyErr } = await admin
    .from("trading_ai_bridge_keys")
    .select("id, user_id, revoked_at")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (keyErr) {
    return NextResponse.json(
      { ok: false, error: keyErr.message || "Bridge table error — jalankan migrasi SQL." },
      { status: 500 },
    );
  }
  if (!keyRow || keyRow.revoked_at) {
    return NextResponse.json({ ok: false, error: "API key tidak valid / sudah dicabut" }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbol = ((url.searchParams.get("symbol") || "XAUUSD").trim().toUpperCase() ||
    "XAUUSD") as SymbolCode;

  const [m5, m1] = await Promise.all([
    loadCandles(admin, {
      userId: keyRow.user_id,
      symbol,
      timeframe: "M5",
      limit: 200,
    }),
    loadCandles(admin, {
      userId: keyRow.user_id,
      symbol,
      timeframe: "M1",
      limit: 200,
    }),
  ]);

  if (
    m5.length < DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles ||
    m1.length < DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles
  ) {
    return NextResponse.json({
      ok: true,
      signalId: `sig_wait_thin_${Date.now()}`,
      version: TRADING_AI_VERSION,
      symbol,
      decision: "WAIT",
      confidence: 0,
      serverExecutable: false,
      eaMayExecute: false,
      lot: null,
      stopLoss: null,
      takeProfit: null,
      reasons: [
        `Candle feed insufficient: M5=${m5.length}/${DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles}, M1=${m1.length}/${DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles}. Keep GercepCandlePush running.`,
      ],
      trend: "unknown",
      support: null,
      resistance: null,
      pullback: false,
      rejection: false,
      momentum: false,
      rulesPassed: [],
      rulesFailed: ["Insufficient candles for Brain."],
      generatedAt: Date.now(),
    });
  }

  const lastClose = m1[m1.length - 1].close;
  const bid = num(url.searchParams.get("bid")) ?? lastClose;
  const ask = num(url.searchParams.get("ask")) ?? bid + 0.2;
  const spread = num(url.searchParams.get("spread")) ?? Math.max(0, Math.round((ask - bid) * 100));
  const balance = num(url.searchParams.get("balance"));

  const openSideRaw = (url.searchParams.get("open_side") || "none").toUpperCase();
  const openPositions: OpenPosition[] = [];
  if (openSideRaw === "BUY" || openSideRaw === "SELL") {
    const openPrice = num(url.searchParams.get("open_price")) ?? bid;
    const openLot = num(url.searchParams.get("open_lot")) ?? DEFAULT_TRADING_AI_CONFIG.risk.defaultLot;
    const ticket = url.searchParams.get("open_ticket") || "mt5";
    openPositions.push({
      id: String(ticket),
      symbol,
      side: openSideRaw,
      lot: openLot,
      openPrice,
      stopLoss: num(url.searchParams.get("open_sl")),
      takeProfit: num(url.searchParams.get("open_tp")),
      openedAt: Date.now(),
      floatingPnl: num(url.searchParams.get("open_pnl")) ?? 0,
    });
  }

  const result = decideTradingAction(
    {
      symbol,
      m5Candles: m5,
      m1Candles: m1,
      market: { symbol, bid, ask, spread, at: Date.now() },
      openPositions,
    },
    { balance },
  );

  await admin
    .from("trading_ai_bridge_keys")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  const signal = toEaTradeSignal(result);
  return NextResponse.json(signal);
}
