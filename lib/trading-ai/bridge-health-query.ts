/**
 * Pengambilan status bridge dari Supabase.
 *
 * Dipakai dua tempat supaya tidak ada dua sumber kebenaran:
 *  - app/api/trading-ai/health/route.ts  (polling dari UI)
 *  - app/dashboard/trading-ai/page.tsx   (state awal, supaya UI tidak spinner)
 *
 * READ-ONLY. Tidak memanggil Trading Brain, tidak mengirim order.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BRIDGE_CONNECT_TIMEOUT_SEC,
  BRIDGE_HEALTHY_WINDOW_SEC,
  BRIDGE_PROBE_TIMEOUT_MS,
  combineBridgeState,
  evaluateChannelHealth,
  summarizeBridge,
  type BridgeHealth,
  type BridgeProbe,
} from "./bridge-health";

export type BridgeAccountInfo = {
  mode: string | null;
  login: number | null;
  lastDecision: string | null;
  autotrade: boolean;
  emergencyStop: boolean;
  /** TimeCurrent() terakhir dari EA — detik epoch ala MT5. */
  brokerTimeSec: number | null;
  /** TimeCurrent() - TimeGMT() dari EA. */
  gmtOffsetSec: number | null;
  /** Kapan heartbeat broker terakhir diterima (epoch ms sungguhan). */
  brokerCapturedAtMs: number | null;
};

export type BridgeHealthResult = BridgeHealth & { account: BridgeAccountInfo };

type ProbeResult<T> = { probe: BridgeProbe; data: T | null };

/**
 * Satu probe dengan hard timeout. Sebelum ini BRIDGE_PROBE_TIMEOUT_MS
 * didefinisikan tapi tidak dipakai — hang Supabase membuat halaman
 * dashboard/loading.tsx berdenyut tanpa batas.
 */
async function probe<T>(
  target: string,
  run: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
  timeoutMs = BRIDGE_PROBE_TIMEOUT_MS,
): Promise<ProbeResult<T>> {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const raced = await Promise.race([
      run(),
      new Promise<{ data: null; error: { message: string; code: string } }>((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              data: null,
              error: {
                code: "TIMEOUT",
                message: `Probe ${target} timeout setelah ${timeoutMs}ms.`,
              },
            }),
          timeoutMs,
        );
      }),
    ]);
    const { data, error } = raced;
    return {
      data: error ? null : data,
      probe: {
        target,
        startedAt,
        latencyMs: Date.now() - startedAt,
        ok: !error,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
      },
    };
  } catch (e) {
    return {
      data: null,
      probe: {
        target,
        startedAt,
        latencyMs: Date.now() - startedAt,
        ok: false,
        errorCode: "EXCEPTION",
        errorMessage: e instanceof Error ? e.message : String(e),
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Ubah error Postgres mentah jadi instruksi yang bisa ditindaklanjuti. */
function hint(message: string | null): string | null {
  if (!message) return null;
  if (/column .* does not exist|schema cache/i.test(message)) {
    return `${message} — jalankan migrasi 20260811_trading_ai_bridge_health.sql.`;
  }
  if (/relation .* does not exist/i.test(message)) {
    return `${message} — jalankan migrasi Trading AI di Supabase.`;
  }
  return message;
}

export async function collectBridgeHealth(
  supabase: SupabaseClient,
  userId: string,
): Promise<BridgeHealthResult> {
  const checkedAt = Date.now();

  const [keyProbe, feedProbe, execProbe] = await Promise.all([
    probe("supabase:trading_ai_bridge_keys", async () =>
      supabase
        .from("trading_ai_bridge_keys")
        .select("id, created_at, last_seen_at")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    probe("supabase:trading_ai_candles", async () =>
      supabase
        .from("trading_ai_candles")
        .select("updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    probe("supabase:trading_ai_execution_control", async () =>
      supabase
        .from("trading_ai_execution_control")
        .select(
          "last_signal_at, last_signal_account_mode, last_signal_account_login, last_signal_decision, autotrade_enabled, emergency_stop, last_broker_time, broker_gmt_offset_sec",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ),
  ]);

  const keyRow = keyProbe.data as { created_at?: string } | null;
  const feedRow = feedProbe.data as { updated_at?: string } | null;
  const execRow = execProbe.data as {
    last_signal_at?: string;
    last_signal_account_mode?: string;
    last_signal_account_login?: number;
    last_signal_decision?: string;
    autotrade_enabled?: boolean;
    emergency_stop?: boolean;
    last_broker_time?: number | null;
    broker_gmt_offset_sec?: number | null;
  } | null;

  const hasApiKey = Boolean(keyRow);
  const waitingSince = ms(keyRow?.created_at);
  // Key gagal dibaca = seluruh status tidak bisa dipercaya, jadi semua channel ERROR.
  const keyError = hint(keyProbe.probe.errorMessage);

  const feed = evaluateChannelHealth({
    id: "feed",
    label: "Candle feed",
    expert: "GercepCandlePush",
    lastSeenAt: ms(feedRow?.updated_at),
    waitingSince,
    hasApiKey,
    probeError: keyError ?? hint(feedProbe.probe.errorMessage),
    now: checkedAt,
  });

  const executor = evaluateChannelHealth({
    id: "executor",
    label: "Signal executor",
    expert: "GercepTradeExecutor",
    lastSeenAt: ms(execRow?.last_signal_at),
    waitingSince,
    hasApiKey,
    probeError: keyError ?? hint(execProbe.probe.errorMessage),
    now: checkedAt,
  });

  const channels = [feed, executor];
  const state = combineBridgeState(channels.map((c) => c.state));

  return {
    state,
    checkedAt,
    healthyWindowSec: BRIDGE_HEALTHY_WINDOW_SEC,
    connectTimeoutSec: BRIDGE_CONNECT_TIMEOUT_SEC,
    channels,
    probes: [keyProbe.probe, feedProbe.probe, execProbe.probe],
    summary: summarizeBridge(state, channels),
    account: {
      mode: execRow?.last_signal_account_mode ?? null,
      login: execRow?.last_signal_account_login ?? null,
      lastDecision: execRow?.last_signal_decision ?? null,
      autotrade: execRow?.autotrade_enabled === true,
      emergencyStop: execRow?.emergency_stop === true,
      brokerTimeSec:
        execRow?.last_broker_time != null && Number.isFinite(Number(execRow.last_broker_time))
          ? Number(execRow.last_broker_time)
          : null,
      gmtOffsetSec:
        execRow?.broker_gmt_offset_sec != null &&
        Number.isFinite(Number(execRow.broker_gmt_offset_sec))
          ? Number(execRow.broker_gmt_offset_sec)
          : null,
      brokerCapturedAtMs: ms(execRow?.last_signal_at),
    },
  };
}
