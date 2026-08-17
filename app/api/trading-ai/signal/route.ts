import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideTradingAction,
  DEFAULT_EXECUTION_CONTROL,
  DEFAULT_TRADING_AI_CONFIG,
  evaluateExecutionGate,
  evaluateRuntimeControl,
  EXECUTION_MIN_CONFIDENCE,
  EXECUTION_MODE,
  HARD_RULES,
  isEaSignalExecutionEnabled,
  loadCandles,
  normalizeGoldSpreadPoints,
  normalizeTradingSymbol,
  parseAccountMode,
  parseExecutionControlRow,
  buildSignalId,
  toEaTradeSignal,
  TRADING_AI_VERSION,
  type ExecutionControlState,
  type OpenPosition,
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
 *   account_mode=demo|contest|real   <-- demo|real boleh executable (live unlocked)
 *   bid, ask, spread (optional — defaults from last M1 close)
 *   open_side=BUY|SELL|none
 *   open_price, open_lot, open_ticket, balance (optional)
 *
 * Server tidak pernah memanggil API broker. EA satu-satunya eksekutor,
 * dan hanya boleh OrderSend saat SEMUA ini benar:
 *   - serverExecutable=true (gate demo|real di server)
 *   - eaMayExecute (env TRADING_AI_EA_SIGNALS=1)
 *   - EA InpAllowTrading=true
 *   - Mode akun demo/real (contest ditolak); InpRequireDemo opsional
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
      execution: {
        mode: EXECUTION_MODE,
        demoOnly: !HARD_RULES.ALLOW_LIVE_EXECUTION,
        allowLiveExecution: HARD_RULES.ALLOW_LIVE_EXECUTION,
        minConfidence: EXECUTION_MIN_CONFIDENCE,
        requiredParam: HARD_RULES.ALLOW_LIVE_EXECUTION
          ? "account_mode=demo|real"
          : "account_mode=demo",
      },
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
  const symbol = normalizeTradingSymbol(url.searchParams.get("symbol"));

  // Mode akun dari EA. Param hilang/typo -> "unknown" -> gate menolak.
  // "real" boleh executable hanya jika ALLOW_LIVE_EXECUTION=true.
  const accountMode = parseAccountMode(url.searchParams.get("account_mode"));
  const accountLogin = num(url.searchParams.get("account_login"));
  // Jam server broker dari EA — sama dengan yang tampil di chart MT5.
  const brokerTime = num(url.searchParams.get("broker_time"));
  const gmtOffsetSec = num(url.searchParams.get("gmt_offset_sec"));

  // Kontrol runtime dari dashboard. Tabel belum ada / query gagal => default OFF.
  let control: ExecutionControlState = { ...DEFAULT_EXECUTION_CONTROL };
  let controlReady = true;
  try {
    const { data: ctlRow, error: ctlErr } = await admin
      .from("trading_ai_execution_control")
      .select(
        "autotrade_enabled, emergency_stop, close_all_on_stop, cooldown_seconds, lot, last_entry_at, last_entry_signal_id",
      )
      .eq("user_id", keyRow.user_id)
      .maybeSingle();
    if (ctlErr) controlReady = false;
    else control = parseExecutionControlRow(ctlRow);
  } catch {
    controlReady = false;
  }

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
    // EA tetap dianggap hidup walau feed tipis — heartbeat sebelum return.
    await admin
      .from("trading_ai_bridge_keys")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", keyRow.id);
    const thinSignalId = `sig_wait_thin_${Date.now()}`;
    const { error: thinHbErr } = await admin.from("trading_ai_execution_control").upsert(
      {
        user_id: keyRow.user_id,
        last_signal_at: new Date().toISOString(),
        last_signal_account_mode: accountMode,
        last_signal_account_login: accountLogin,
        last_signal_decision: "WAIT",
        last_signal_id: thinSignalId,
        last_signal_confidence: 0,
        last_signal_spread: null,
        last_signal_m5_bias: "unknown",
        last_signal_m1_direction: "unknown",
        last_signal_executable: false,
        last_broker_time: brokerTime,
        broker_gmt_offset_sec: gmtOffsetSec,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (thinHbErr) {
      console.warn(
        "[trading-ai/signal] thin-feed heartbeat gagal:",
        thinHbErr.code,
        thinHbErr.message,
      );
    }

    return NextResponse.json({
      ok: true,
      signalId: thinSignalId,
      version: TRADING_AI_VERSION,
      symbol,
      decision: "WAIT",
      confidence: 0,
      serverExecutable: false,
      accountMode,
      minConfidence: EXECUTION_MIN_CONFIDENCE,
      executionBlockedBy: ["Candle feed belum cukup — WAIT tidak pernah executable."],
      eaMayExecute: false,
      executionMode: EXECUTION_MODE,
      autotrade: control.autotradeEnabled,
      emergencyStop: control.emergencyStop,
      cooldownRemaining: 0,
      m5Bias: "unknown",
      m1Direction: "unknown",
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
  const spreadRaw =
    num(url.searchParams.get("spread")) ?? Math.max(0, Math.round((ask - bid) * 100));
  const spread = normalizeGoldSpreadPoints({ spread: spreadRaw, bid, ask });
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
    { balance, accountMode },
  );

  await admin
    .from("trading_ai_bridge_keys")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  const barTime = m1[m1.length - 1]?.time ?? null;
  const signalId = buildSignalId(result, barTime);

  const runtime = evaluateRuntimeControl({
    decision: result.decision,
    state: control,
    hasOpenPosition: openPositions.length > 0,
    signalId,
  });

  const controlBlockedBy = [...runtime.blockedBy];
  if (!controlReady) {
    controlBlockedBy.push(
      "Tabel execution control belum ada — jalankan migrasi 20260810_trading_ai_demo_autotrade.sql.",
    );
  }

  let signal = toEaTradeSignal(result, {
    barTime,
    autotrade: control.autotradeEnabled,
    emergencyStop: control.emergencyStop,
    cooldownRemaining: runtime.cooldownRemainingSec,
    controlBlockedBy,
    lot: control.lot,
  });

  // EMERGENCY STOP + close-all: lapisan eksekusi memaksa CLOSE.
  // Trading Brain tidak diubah — override hanya terjadi di sini dan tercatat.
  if (runtime.forceClose && openPositions.length > 0 && signal.decision !== "CLOSE") {
    const closeGate = evaluateExecutionGate({
      decision: "CLOSE",
      confidence: result.confidence,
      accountMode,
      validationValid: true,
      riskAllowed: true,
      configMinConfidence: DEFAULT_TRADING_AI_CONFIG.brain.minConfidenceToEnter,
    });
    signal = {
      ...signal,
      decision: "CLOSE",
      signalId: `${signal.signalId}_estop`,
      serverExecutable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
      reasons: [
        "EMERGENCY STOP + close-all aktif — tutup posisi berjalan.",
        ...signal.reasons,
      ].slice(0, 8),
    };
  }

  // Heartbeat + snapshot untuk panel live dashboard. Gagal di sini
  // tidak boleh menjatuhkan respons sinyal ke EA.
  const { error: hbErr } = await admin.from("trading_ai_execution_control").upsert(
    {
      user_id: keyRow.user_id,
      last_signal_at: new Date().toISOString(),
      last_signal_account_mode: accountMode,
      last_signal_account_login: accountLogin,
      last_signal_decision: signal.decision,
      last_signal_id: signal.signalId,
      last_signal_confidence: signal.confidence,
      last_signal_spread: spread,
      last_signal_m5_bias: signal.m5Bias,
      last_signal_m1_direction: signal.m1Direction,
      last_signal_executable: signal.serverExecutable,
      last_broker_time: brokerTime,
      broker_gmt_offset_sec: gmtOffsetSec,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (hbErr) {
    console.warn(
      "[trading-ai/signal] executor heartbeat gagal:",
      hbErr.code,
      hbErr.message,
    );
  }

  return NextResponse.json({ ...signal, accountLogin });
}
