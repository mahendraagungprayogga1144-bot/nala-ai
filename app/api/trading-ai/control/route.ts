import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  clampCooldownSeconds,
  clampLot,
  cooldownRemainingSeconds,
  DEFAULT_EXECUTION_CONTROL,
  EXECUTION_MODE,
  parseExecutionControlRow,
  type ExecutionControlState,
} from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT =
  "autotrade_enabled, live_enable, emergency_stop, close_all_on_stop, cooldown_seconds, lot, last_entry_at, last_entry_signal_id";

type Action =
  | "autotrade_on"
  | "autotrade_off"
  | "live_enable_on"
  | "live_enable_off"
  | "emergency_stop"
  | "resume"
  | "settings";

const ACTIONS: Action[] = [
  "autotrade_on",
  "autotrade_off",
  "live_enable_on",
  "live_enable_off",
  "emergency_stop",
  "resume",
  "settings",
];

function payload(state: ExecutionControlState, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    executionMode: EXECUTION_MODE,
    control: {
      ...state,
      cooldownRemaining: cooldownRemainingSeconds(state),
    },
    ...extra,
  };
}

/** GET — status tombol untuk dashboard. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("trading_ai_execution_control")
    .select(SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ...payload(DEFAULT_EXECUTION_CONTROL), ready: false, error: error.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ...payload(parseExecutionControlRow(data)), ready: true });
}

/**
 * POST — tombol dashboard.
 *
 * body: { action, closeAllOnStop?, cooldownSeconds?, lot? }
 *
 * EMERGENCY STOP sengaja ikut mematikan autotrade: menyalakan lagi harus
 * lewat aksi "resume" yang eksplisit, bukan efek samping.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    action?: string;
    closeAllOnStop?: boolean;
    cooldownSeconds?: number;
    lot?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action harus salah satu dari: ${ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const { data: current } = await supabase
    .from("trading_ai_execution_control")
    .select(SELECT)
    .eq("user_id", user.id)
    .maybeSingle();
  const state = parseExecutionControlRow(current);

  const next: ExecutionControlState = { ...state };

  if (action === "autotrade_on") {
    if (state.emergencyStop) {
      return NextResponse.json(
        {
          error:
            "EMERGENCY STOP masih aktif. Tekan RESUME dulu sebelum menyalakan LIVE AUTOTRADE.",
        },
        { status: 409 },
      );
    }
    next.autotradeEnabled = true;
  } else if (action === "autotrade_off") {
    next.autotradeEnabled = false;
  } else if (action === "live_enable_on") {
    if (state.emergencyStop) {
      return NextResponse.json(
        {
          error:
            "EMERGENCY STOP masih aktif. Tekan RESUME dulu sebelum menyalakan LIVE ENABLE.",
        },
        { status: 409 },
      );
    }
    next.liveEnable = true;
  } else if (action === "live_enable_off") {
    next.liveEnable = false;
  } else if (action === "emergency_stop") {
    next.emergencyStop = true;
    next.autotradeEnabled = false;
  } else if (action === "resume") {
    next.emergencyStop = false;
    next.autotradeEnabled = false;
  }

  if (typeof body.closeAllOnStop === "boolean") next.closeAllOnStop = body.closeAllOnStop;
  if (body.cooldownSeconds !== undefined) {
    next.cooldownSeconds = clampCooldownSeconds(body.cooldownSeconds);
  }
  if (body.lot !== undefined) {
    next.lot = clampLot(body.lot);
  }

  const { data, error } = await supabase
    .from("trading_ai_execution_control")
    .upsert(
      {
        user_id: user.id,
        autotrade_enabled: next.autotradeEnabled,
        live_enable: next.liveEnable,
        emergency_stop: next.emergencyStop,
        close_all_on_stop: next.closeAllOnStop,
        cooldown_seconds: next.cooldownSeconds,
        lot: next.lot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...payload(parseExecutionControlRow(data)), action });
}
