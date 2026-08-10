import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAccountMode } from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["READY", "FILLED", "FAILED", "CLOSED", "CLOSE_FAILED"] as const;
type OrderStatus = (typeof STATUSES)[number];

function bearer(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return (req.headers.get("x-gercep-key") || "").trim();
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/trading-ai/order-report
 *
 * EA melaporkan hasil eksekusi. Ini yang membuat cooldown berjalan:
 * cooldown baru dihitung dari order yang BENAR-BENAR filled, bukan dari
 * sinyal yang dikirim server.
 *
 * Unique index (user_id, signal_id) untuk status FILLED/FAILED menegakkan
 * aturan "satu signal = maksimal satu order attempt" walau EA restart.
 */
export async function POST(request: Request) {
  const apiKey = bearer(request);
  if (!apiKey.startsWith("gea_")) {
    return NextResponse.json({ ok: false, error: "Invalid API key" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Server belum dikonfigurasi (service role)." },
      { status: 503 },
    );
  }

  const { data: keyRow, error: keyErr } = await admin
    .from("trading_ai_bridge_keys")
    .select("id, user_id, revoked_at")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (keyErr) {
    return NextResponse.json({ ok: false, error: keyErr.message }, { status: 500 });
  }
  if (!keyRow || keyRow.revoked_at) {
    return NextResponse.json(
      { ok: false, error: "API key tidak valid / sudah dicabut" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const status = String(body.status || "").toUpperCase() as OrderStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { ok: false, error: `status harus salah satu dari: ${STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const signalId = String(body.signalId || "").trim();
  if (!signalId) {
    return NextResponse.json({ ok: false, error: "signalId wajib diisi" }, { status: 400 });
  }

  const directionRaw = String(body.direction || "").toUpperCase();
  const direction =
    directionRaw === "BUY" || directionRaw === "SELL" || directionRaw === "CLOSE"
      ? directionRaw
      : null;

  const row = {
    user_id: keyRow.user_id,
    signal_id: signalId,
    symbol: String(body.symbol || "XAUUSD").toUpperCase(),
    status,
    direction,
    lot: numOrNull(body.lot),
    ticket: numOrNull(body.ticket),
    entry_price: numOrNull(body.entryPrice),
    spread: numOrNull(body.spread),
    confidence: numOrNull(body.confidence),
    account_mode: parseAccountMode(String(body.accountMode ?? "")),
    account_login: numOrNull(body.accountLogin),
    error_code: numOrNull(body.errorCode),
    error_message: body.errorMessage ? String(body.errorMessage).slice(0, 500) : null,
  };

  const { error: insErr } = await admin.from("trading_ai_orders").insert(row);

  if (insErr) {
    // 23505 = unique violation -> attempt kedua untuk signal yang sama.
    if (insErr.code === "23505") {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        note: "Signal ini sudah pernah dieksekusi. Tidak ada attempt kedua.",
      });
    }
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  // Cooldown hanya dimulai oleh entry yang benar-benar terisi.
  if (status === "FILLED" && (direction === "BUY" || direction === "SELL")) {
    await admin.from("trading_ai_execution_control").upsert(
      {
        user_id: keyRow.user_id,
        last_entry_at: new Date().toISOString(),
        last_entry_signal_id: signalId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  return NextResponse.json({ ok: true, recorded: status, signalId });
}
