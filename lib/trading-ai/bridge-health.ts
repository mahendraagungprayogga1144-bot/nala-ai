/**
 * MT5 Bridge Health — status koneksi jembatan EA <-> Gercep.
 *
 * PENTING soal arti "CONNECTED":
 * Server tidak pernah menghubungi MT5. Tidak ada WebSocket, tidak ada
 * connector. Yang ada hanya EA yang menghubungi server lewat HTTP.
 * Karena itu CONNECTED TIDAK BOLEH disimpulkan dari "API Gercep hidup".
 * Satu-satunya bukti sah adalah heartbeat yang hanya bisa dibuat terminal MT5:
 *
 *   feed     -> trading_ai_candles.updated_at   (GercepCandlePush push candle)
 *   executor -> trading_ai_execution_control.last_signal_at (GercepTradeExecutor polling)
 *
 * Kalau MT5 mati, dua angka itu berhenti bergerak dan status turun sendiri.
 *
 * Modul ini murni: tidak menyentuh DB, tidak menyentuh Trading Brain.
 */

/** Batas atas umur heartbeat yang masih dianggap hidup. */
export const BRIDGE_HEALTHY_WINDOW_SEC = 90;
/** Batas CONNECTING. Lewat ini tanpa heartbeat = DISCONNECTED, bukan loading selamanya. */
export const BRIDGE_CONNECT_TIMEOUT_SEC = 120;
/** Timeout satu probe HTTP/DB dari UI. */
export const BRIDGE_PROBE_TIMEOUT_MS = 8_000;

export type BridgeConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

export type BridgeChannelId = "feed" | "executor";

export type BridgeChannelHealth = {
  id: BridgeChannelId;
  label: string;
  /** EA mana yang bertanggung jawab — untuk pesan perbaikan yang konkret. */
  expert: string;
  state: BridgeConnectionState;
  /** Epoch ms heartbeat terakhir. null = belum pernah. */
  lastSeenAt: number | null;
  ageSec: number | null;
  detail: string;
};

/** Satu percobaan koneksi ke dependensi, lengkap untuk kebutuhan log. */
export type BridgeProbe = {
  target: string;
  startedAt: number;
  latencyMs: number;
  ok: boolean;
  errorCode: string | null;
  errorMessage: string | null;
};

export type BridgeHealth = {
  state: BridgeConnectionState;
  checkedAt: number;
  healthyWindowSec: number;
  connectTimeoutSec: number;
  channels: BridgeChannelHealth[];
  probes: BridgeProbe[];
  summary: string;
};

const SEVERITY: Record<BridgeConnectionState, number> = {
  CONNECTED: 0,
  CONNECTING: 1,
  DISCONNECTED: 2,
  ERROR: 3,
};

/** State gabungan = kondisi terburuk antar channel. Tidak pernah optimistis. */
export function combineBridgeState(states: BridgeConnectionState[]): BridgeConnectionState {
  if (!states.length) return "ERROR";
  return states.reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), "CONNECTED");
}

export function ageSeconds(lastSeenAt: number | null, now: number): number | null {
  if (!lastSeenAt || !Number.isFinite(lastSeenAt)) return null;
  return Math.max(0, Math.round((now - lastSeenAt) / 1000));
}

export type ChannelInput = {
  id: BridgeChannelId;
  label: string;
  expert: string;
  /** Epoch ms heartbeat terakhir dari EA. */
  lastSeenAt: number | null;
  /**
   * Epoch ms saat bridge mulai "menunggu" (mis. API key dibuat).
   * Dipakai untuk membedakan CONNECTING (baru disetup) dari DISCONNECTED.
   */
  waitingSince?: number | null;
  /** Ada API key aktif. false = belum disetup sama sekali. */
  hasApiKey: boolean;
  /** Error nyata dari probe. Kalau ada, channel langsung ERROR. */
  probeError?: string | null;
  now: number;
  healthyWindowSec?: number;
  connectTimeoutSec?: number;
};

/**
 * Evaluasi satu channel. Urutan cek sengaja: error dulu, lalu setup,
 * lalu heartbeat. Tidak ada jalur yang menghasilkan "loading" tanpa batas.
 */
export function evaluateChannelHealth(input: ChannelInput): BridgeChannelHealth {
  const healthyWindowSec = input.healthyWindowSec ?? BRIDGE_HEALTHY_WINDOW_SEC;
  const connectTimeoutSec = input.connectTimeoutSec ?? BRIDGE_CONNECT_TIMEOUT_SEC;
  const age = ageSeconds(input.lastSeenAt, input.now);

  const base = {
    id: input.id,
    label: input.label,
    expert: input.expert,
    lastSeenAt: input.lastSeenAt,
    ageSec: age,
  };

  if (input.probeError) {
    return { ...base, state: "ERROR", detail: input.probeError };
  }

  if (!input.hasApiKey) {
    return {
      ...base,
      state: "DISCONNECTED",
      detail: "Belum ada API key EA. Buat key dulu di panel MT5 bridge.",
    };
  }

  if (age == null) {
    const waited =
      input.waitingSince != null
        ? Math.max(0, Math.round((input.now - input.waitingSince) / 1000))
        : null;
    if (waited != null && waited < connectTimeoutSec) {
      return {
        ...base,
        state: "CONNECTING",
        detail: `Menunggu heartbeat pertama dari ${input.expert} (${waited}s dari batas ${connectTimeoutSec}s).`,
      };
    }
    return {
      ...base,
      state: "DISCONNECTED",
      detail: `${input.expert} belum pernah mengirim data. Pastikan EA terpasang di chart XAUUSD dan Algo Trading menyala.`,
    };
  }

  if (age <= healthyWindowSec) {
    return { ...base, state: "CONNECTED", detail: `Heartbeat ${age}s lalu dari ${input.expert}.` };
  }

  return {
    ...base,
    state: "DISCONNECTED",
    detail: `Heartbeat terakhir ${age}s lalu, melewati batas ${healthyWindowSec}s. ${input.expert} kemungkinan berhenti atau ter-remove dari chart.`,
  };
}

export function summarizeBridge(
  state: BridgeConnectionState,
  channels: BridgeChannelHealth[],
): string {
  if (state === "CONNECTED") return "MT5 bridge hidup — feed dan executor keduanya mengirim heartbeat.";
  if (state === "ERROR") {
    const bad = channels.find((c) => c.state === "ERROR");
    return bad ? `Gagal cek bridge: ${bad.detail}` : "Gagal cek bridge.";
  }
  const down = channels.filter((c) => c.state !== "CONNECTED").map((c) => c.label);
  if (state === "CONNECTING") return `Menunggu heartbeat pertama: ${down.join(", ")}.`;
  return `Tidak terhubung: ${down.join(", ")}.`;
}
