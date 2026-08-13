/**
 * Ringkasan aktivitas live untuk dashboard.
 * READ-ONLY — tidak memanggil Trading Brain, tidak mengirim order.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type LiveSignalSnapshot = {
  signalId: string | null;
  decision: string | null;
  confidence: number | null;
  spread: number | null;
  m5Bias: string | null;
  m1Direction: string | null;
  serverExecutable: boolean | null;
  accountMode: string | null;
  accountLogin: number | null;
  autotrade: boolean;
  emergencyStop: boolean;
  at: string | null;
};

export type LiveOrderRow = {
  id: number;
  signalId: string;
  status: string;
  direction: string | null;
  lot: number | null;
  ticket: number | null;
  entryPrice: number | null;
  spread: number | null;
  confidence: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type LiveActivity = {
  signal: LiveSignalSnapshot;
  orders: LiveOrderRow[];
  openHint: string;
};

const EMPTY_SIGNAL: LiveSignalSnapshot = {
  signalId: null,
  decision: null,
  confidence: null,
  spread: null,
  m5Bias: null,
  m1Direction: null,
  serverExecutable: null,
  accountMode: null,
  accountLogin: null,
  autotrade: false,
  emergencyStop: false,
  at: null,
};

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function buildOpenHint(signal: LiveSignalSnapshot, latestOrder: LiveOrderRow | null): string {
  if (signal.emergencyStop) return "EMERGENCY STOP — entry baru ditahan.";
  if (!signal.autotrade) return "LIVE AUTOTRADE OFF — nyalakan di dashboard.";
  if (latestOrder?.status === "FILLED" && latestOrder.direction !== "CLOSE") {
    return `Posisi terakhir ${latestOrder.direction} lot ${latestOrder.lot ?? "?"} @ ${latestOrder.entryPrice ?? "?"} (tiket ${latestOrder.ticket ?? "—"}).`;
  }
  if (latestOrder?.status === "FAILED") {
    return `Order terakhir GAGAL: ${latestOrder.errorMessage || latestOrder.errorCode || "unknown"}.`;
  }
  const d = (signal.decision || "").toUpperCase();
  if (d === "WAIT" || !d) {
    return "Sinyal sekarang WAIT — menunggu setup BUY/SELL dari Trading Brain.";
  }
  if ((d === "BUY" || d === "SELL") && signal.serverExecutable) {
    return `Sinyal ${d} siap dieksekusi EA (confidence ${signal.confidence ?? "—"}).`;
  }
  if (d === "BUY" || d === "SELL") {
    return `Sinyal ${d} ada tapi belum executable di server.`;
  }
  if (d === "CLOSE") return "Sinyal CLOSE — EA harus menutup posisi demo.";
  return "Menunggu update dari GercepTradeExecutor.";
}

export async function collectLiveActivity(
  supabase: SupabaseClient,
  userId: string,
  orderLimit = 12,
): Promise<LiveActivity> {
  const [ctlRes, ordRes] = await Promise.all([
    supabase
      .from("trading_ai_execution_control")
      .select(
        "autotrade_enabled, emergency_stop, last_signal_at, last_signal_id, last_signal_decision, last_signal_confidence, last_signal_spread, last_signal_m5_bias, last_signal_m1_direction, last_signal_executable, last_signal_account_mode, last_signal_account_login",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("trading_ai_orders")
      .select(
        "id, signal_id, status, direction, lot, ticket, entry_price, spread, confidence, error_code, error_message, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(orderLimit),
  ]);

  const ctl = ctlRes.data as Record<string, unknown> | null;
  const signal: LiveSignalSnapshot = ctl
    ? {
        signalId: (ctl.last_signal_id as string) ?? null,
        decision: (ctl.last_signal_decision as string) ?? null,
        confidence: numOrNull(ctl.last_signal_confidence),
        spread: numOrNull(ctl.last_signal_spread),
        m5Bias: (ctl.last_signal_m5_bias as string) ?? null,
        m1Direction: (ctl.last_signal_m1_direction as string) ?? null,
        serverExecutable:
          typeof ctl.last_signal_executable === "boolean"
            ? ctl.last_signal_executable
            : null,
        accountMode: (ctl.last_signal_account_mode as string) ?? null,
        accountLogin: numOrNull(ctl.last_signal_account_login),
        autotrade: ctl.autotrade_enabled === true,
        emergencyStop: ctl.emergency_stop === true,
        at: (ctl.last_signal_at as string) ?? null,
      }
    : { ...EMPTY_SIGNAL };

  const orders: LiveOrderRow[] = ((ordRes.data as Record<string, unknown>[] | null) || []).map(
    (r) => ({
      id: Number(r.id),
      signalId: String(r.signal_id ?? ""),
      status: String(r.status ?? ""),
      direction: (r.direction as string) ?? null,
      lot: numOrNull(r.lot),
      ticket: numOrNull(r.ticket),
      entryPrice: numOrNull(r.entry_price),
      spread: numOrNull(r.spread),
      confidence: numOrNull(r.confidence),
      errorCode: numOrNull(r.error_code),
      errorMessage: (r.error_message as string) ?? null,
      createdAt: String(r.created_at ?? ""),
    }),
  );

  return {
    signal,
    orders,
    openHint: buildOpenHint(signal, orders[0] ?? null),
  };
}
