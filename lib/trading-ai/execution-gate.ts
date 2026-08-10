/**
 * Execution Gate — SATU-SATUNYA tempat yang boleh menghasilkan executable = true.
 *
 * Semua layer (decide, exit, signal API, EA response) wajib lewat sini.
 * Default fail-closed: kalau ada input yang tidak jelas, hasilnya false.
 *
 * TITIK KRITIS DEMO-ONLY:
 * - `accountMode` harus persis "demo".
 * - `HARD_RULES.ALLOW_LIVE_EXECUTION` harus true sebelum mode lain diizinkan.
 *   Flag itu satu-satunya pintu untuk membuka live nanti (task terpisah).
 */

import {
  EXECUTION_MIN_CONFIDENCE,
  isEaSignalExecutionEnabled,
  isLiveExecutionAllowed,
} from "./config";
import type { TradeDecision } from "./types";

/** Mirrors MT5 ACCOUNT_TRADE_MODE: 0 demo, 1 contest, 2 real. */
export type AccountMode = "demo" | "contest" | "real" | "unknown";

export type ExecutionGate = {
  /** true hanya kalau SEMUA syarat demo-only terpenuhi. */
  executable: boolean;
  accountMode: AccountMode;
  /** Ambang confidence efektif yang dipakai gate ini. */
  minConfidence: number;
  /** Syarat yang lolos — untuk audit. */
  passed: string[];
  /** Alasan diblokir — untuk audit. Kosong berarti tidak ada blocker. */
  blockedBy: string[];
};

/**
 * Parse account mode dari EA / query string.
 * Apa pun yang tidak dikenali -> "unknown" (dan otomatis TIDAK executable).
 */
export function parseAccountMode(raw: string | null | undefined): AccountMode {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "demo") return "demo";
  if (v === "contest") return "contest";
  if (v === "real" || v === "live") return "real";
  return "unknown";
}

export function blockedGate(
  accountMode: AccountMode,
  blockedBy: string[],
  minConfidence = EXECUTION_MIN_CONFIDENCE,
): ExecutionGate {
  return { executable: false, accountMode, minConfidence, passed: [], blockedBy };
}

export type ExecutionGateInput = {
  decision: TradeDecision;
  confidence: number;
  accountMode: AccountMode;
  /** Hasil rule validator — entry hanya boleh eksekusi kalau valid. */
  validationValid: boolean;
  /** Hasil risk checks (spread, max position, floating). */
  riskAllowed: boolean;
  /** Default: env TRADING_AI_EA_SIGNALS === "1". */
  executionEnabled?: boolean;
  /** Ambang dari config; gate tetap memakai nilai tertinggi vs EXECUTION_MIN_CONFIDENCE. */
  configMinConfidence?: number;
};

/**
 * Evaluasi izin eksekusi. Urutan cek sengaja: safety dulu, baru kualitas sinyal.
 */
export function evaluateExecutionGate(input: ExecutionGateInput): ExecutionGate {
  const {
    decision,
    confidence,
    accountMode,
    validationValid,
    riskAllowed,
    configMinConfidence,
  } = input;

  const executionEnabled = input.executionEnabled ?? isEaSignalExecutionEnabled();

  // Gate tidak pernah lebih longgar dari EXECUTION_MIN_CONFIDENCE,
  // walaupun config brain diturunkan (mis. di test/backtest).
  const minConfidence = Math.max(
    EXECUTION_MIN_CONFIDENCE,
    configMinConfidence ?? EXECUTION_MIN_CONFIDENCE,
  );

  const passed: string[] = [];
  const blockedBy: string[] = [];

  // 1) HARD BLOCK: hanya akun demo. Live/contest/unknown selalu ditolak
  //    selama ALLOW_LIVE_EXECUTION masih false.
  if (accountMode !== "demo") {
    if (!isLiveExecutionAllowed()) {
      blockedBy.push(
        `Account mode "${accountMode}" bukan demo — eksekusi hanya untuk akun DEMO (ALLOW_LIVE_EXECUTION=false).`,
      );
    } else {
      blockedBy.push(`Account mode "${accountMode}" belum didukung.`);
    }
  } else {
    passed.push("Account mode = demo.");
  }

  // 2) Server-side kill switch (env).
  if (!executionEnabled) {
    blockedBy.push("TRADING_AI_EA_SIGNALS != 1 — eksekusi dimatikan di server.");
  } else {
    passed.push("Server execution flag aktif.");
  }

  // 3) WAIT tidak pernah executable. Ini aturan permanen.
  if (decision === "WAIT") {
    blockedBy.push("Decision WAIT tidak pernah executable.");
  }

  // 4) Entry BUY/SELL butuh validasi + risk + confidence.
  if (decision === "BUY" || decision === "SELL") {
    if (!validationValid) blockedBy.push("Rule validator gagal — entry tidak executable.");
    else passed.push("Rule validator lolos.");

    if (!riskAllowed) blockedBy.push("Risk check gagal — entry tidak executable.");
    else passed.push("Risk check lolos.");

    if (!(confidence >= minConfidence)) {
      blockedBy.push(`Confidence ${confidence} < minimum eksekusi ${minConfidence}.`);
    } else {
      passed.push(`Confidence ${confidence} >= ${minConfidence}.`);
    }
  }

  // 5) CLOSE sengaja TIDAK digate confidence: menutup posisi itu aksi
  //    pengurang risiko. Memblokirnya saat confidence rendah justru
  //    menahan posisi yang sudah melawan bias M5.
  if (decision === "CLOSE") {
    passed.push("CLOSE bersifat protektif — tidak digate confidence.");
  }

  return {
    executable: blockedBy.length === 0,
    accountMode,
    minConfidence,
    passed,
    blockedBy,
  };
}
