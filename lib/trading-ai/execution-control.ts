/**
 * Execution Control — lapisan runtime di ATAS execution-gate.
 *
 * execution-gate menjawab "apakah sinyal ini secara prinsip boleh dieksekusi?"
 * (demo-only, confidence, rule/risk). Modul ini menjawab "apakah user sedang
 * mengizinkan robot bekerja sekarang?" (tombol ON/OFF, emergency stop, cooldown).
 *
 * Keduanya harus lolos sebelum EA mengirim order. Trading Brain tidak disentuh:
 * modul ini hanya boleh MEMPERSEMPIT izin, tidak pernah melebarkan.
 */

import type { TradeDecision } from "./types";

/**
 * Mode eksekusi aktif. LIVE_AUTOTRADE = order sungguhan ke akun MT5 demo atau real
 * (bukan paper). Contest tetap ditolak di execution-gate.
 */
export const EXECUTION_MODE = "LIVE_AUTOTRADE" as const;
export type ExecutionMode = typeof EXECUTION_MODE;

/** Jeda antar entry setelah satu order benar-benar FILLED. */
export const DEFAULT_COOLDOWN_SECONDS = 900;
export const MAX_COOLDOWN_SECONDS = 86_400;

export type ExecutionControlState = {
  /** Tombol [LIVE AUTOTRADE ON/OFF]. Default OFF — user harus menyalakan sendiri. */
  autotradeEnabled: boolean;
  /** Tombol [EMERGENCY STOP]. Menghentikan entry baru. */
  emergencyStop: boolean;
  /** Saat emergency stop: true = perintahkan CLOSE posisi berjalan. */
  closeAllOnStop: boolean;
  cooldownSeconds: number;
  /** Epoch ms saat entry terakhir FILLED. null = belum pernah. */
  lastEntryAt: number | null;
  lastEntrySignalId: string | null;
};

export const DEFAULT_EXECUTION_CONTROL: ExecutionControlState = {
  autotradeEnabled: false,
  emergencyStop: false,
  closeAllOnStop: false,
  cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
  lastEntryAt: null,
  lastEntrySignalId: null,
};

export type ExecutionControlRow = {
  autotrade_enabled?: boolean | null;
  emergency_stop?: boolean | null;
  close_all_on_stop?: boolean | null;
  cooldown_seconds?: number | null;
  last_entry_at?: string | null;
  last_entry_signal_id?: string | null;
};

export function clampCooldownSeconds(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_COOLDOWN_SECONDS;
  return Math.min(Math.round(n), MAX_COOLDOWN_SECONDS);
}

/**
 * Baris DB -> state. Baris hilang / kolom null selalu jatuh ke default aman (OFF).
 */
export function parseExecutionControlRow(
  row: ExecutionControlRow | null | undefined,
): ExecutionControlState {
  if (!row) return { ...DEFAULT_EXECUTION_CONTROL };
  const lastEntryMs = row.last_entry_at ? Date.parse(row.last_entry_at) : NaN;
  return {
    autotradeEnabled: row.autotrade_enabled === true,
    emergencyStop: row.emergency_stop === true,
    closeAllOnStop: row.close_all_on_stop === true,
    cooldownSeconds: clampCooldownSeconds(row.cooldown_seconds),
    lastEntryAt: Number.isFinite(lastEntryMs) ? lastEntryMs : null,
    lastEntrySignalId: row.last_entry_signal_id ?? null,
  };
}

export type RuntimeControlInput = {
  decision: TradeDecision;
  state: ExecutionControlState;
  /** Ada posisi milik EA yang sedang terbuka. */
  hasOpenPosition?: boolean;
  /**
   * signalId yang sedang dievaluasi. Dipakai menegakkan
   * "satu signal = maksimal satu order attempt" dari sisi server,
   * sehingga tetap berlaku walau EA di-restart / di-recompile.
   */
  signalId?: string | null;
  now?: number;
};

export type RuntimeControlVerdict = {
  allowed: boolean;
  blockedBy: string[];
  /** Sisa cooldown dalam detik. 0 = bebas. */
  cooldownRemainingSec: number;
  /**
   * Server memerintahkan CLOSE karena emergency stop + closeAllOnStop.
   * Ini override lapisan eksekusi, bukan perubahan keputusan Brain.
   */
  forceClose: boolean;
};

export function cooldownRemainingSeconds(
  state: ExecutionControlState,
  now = Date.now(),
): number {
  if (!state.lastEntryAt || state.cooldownSeconds <= 0) return 0;
  const elapsed = (now - state.lastEntryAt) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0) return state.cooldownSeconds;
  return Math.max(0, Math.ceil(state.cooldownSeconds - elapsed));
}

/**
 * Verdict runtime. Urutan cek: kehendak user dulu, baru cooldown.
 *
 * Catatan CLOSE: menutup posisi selalu menurunkan risiko, jadi CLOSE tidak
 * pernah diblokir cooldown maupun emergency stop. Yang dihentikan emergency
 * stop adalah pembukaan posisi baru.
 */
export function evaluateRuntimeControl(input: RuntimeControlInput): RuntimeControlVerdict {
  const { decision, state } = input;
  const now = input.now ?? Date.now();
  const isEntry = decision === "BUY" || decision === "SELL";
  const blockedBy: string[] = [];

  const cooldownRemainingSec = cooldownRemainingSeconds(state, now);
  const forceClose = Boolean(
    state.emergencyStop && state.closeAllOnStop && input.hasOpenPosition,
  );

  // Force close adalah aksi darurat eksplisit dari user: lolos semua gate lain.
  if (forceClose && decision === "CLOSE") {
    return { allowed: true, blockedBy: [], cooldownRemainingSec, forceClose };
  }

  if (!state.autotradeEnabled) {
    blockedBy.push("LIVE AUTOTRADE OFF — nyalakan dari dashboard untuk eksekusi.");
  }

  if (state.emergencyStop && isEntry) {
    blockedBy.push("EMERGENCY STOP aktif — tidak membuka posisi baru.");
  }

  if (isEntry && cooldownRemainingSec > 0) {
    blockedBy.push(
      `Cooldown aktif — sisa ${cooldownRemainingSec}s dari ${state.cooldownSeconds}s sejak entry terakhir.`,
    );
  }

  if (
    isEntry &&
    input.signalId &&
    state.lastEntrySignalId &&
    input.signalId === state.lastEntrySignalId
  ) {
    blockedBy.push("Signal ini sudah pernah dieksekusi — tidak ada attempt kedua.");
  }

  return {
    allowed: blockedBy.length === 0,
    blockedBy,
    cooldownRemainingSec,
    forceClose,
  };
}
