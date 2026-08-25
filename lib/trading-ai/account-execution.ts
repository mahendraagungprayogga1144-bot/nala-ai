/**
 * Account-agnostic execution status — DEMO dan REAL memakai Trading Brain yang sama.
 * Yang berbeda hanya safety gate di lapisan eksekusi.
 */

import type { AccountMode } from "./execution-gate";

export type AccountSnapshot = {
  mode: AccountMode;
  login: number | null;
  broker: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  freeMargin: number | null;
};

export type AccountExecutionFlags = {
  autotrade: boolean;
  liveEnable: boolean;
  emergencyStop: boolean;
  mt5Connected: boolean;
  riskAllowed: boolean;
  serverExecutable: boolean | null;
};

export type AccountExecutionStatus = {
  accountModeLabel: "DEMO" | "REAL" | "CONTEST" | "UNKNOWN";
  liveEnableLabel: "ON" | "OFF";
  liveExecutionLabel: "ON" | "OFF";
  mt5Label: "CONNECTED" | "DISCONNECTED";
  executionLabel: "READY" | "BLOCKED";
  /** Pesan utama untuk banner dashboard. */
  banner: string;
  blockedBy: string[];
};

export function accountModeLabel(mode: AccountMode | string | null | undefined): AccountExecutionStatus["accountModeLabel"] {
  const m = (mode ?? "").toLowerCase();
  if (m === "demo") return "DEMO";
  if (m === "real" || m === "live") return "REAL";
  if (m === "contest") return "CONTEST";
  return "UNKNOWN";
}

/**
 * Status eksekusi account-agnostic.
 * DEMO: autotrade cukup (LIVE ENABLE tidak wajib).
 * REAL: autotrade + LIVE ENABLE wajib untuk entry.
 */
export function buildAccountExecutionStatus(
  mode: AccountMode | string | null | undefined,
  flags: AccountExecutionFlags,
): AccountExecutionStatus {
  const modeLabel = accountModeLabel(mode);
  const blockedBy: string[] = [];

  if (!flags.mt5Connected) blockedBy.push("MT5 disconnected.");
  if (flags.emergencyStop) blockedBy.push("EMERGENCY STOP aktif.");
  if (!flags.autotrade) blockedBy.push("LIVE AUTOTRADE OFF.");
  if (modeLabel === "REAL" && !flags.liveEnable) {
    blockedBy.push("REAL ACCOUNT DETECTED — LIVE EXECUTION DISABLED");
  }
  if (modeLabel === "CONTEST" || modeLabel === "UNKNOWN") {
    blockedBy.push(`Account mode ${modeLabel} tidak diizinkan untuk auto execution.`);
  }
  if (flags.riskAllowed === false) blockedBy.push("Risk gate FAIL.");
  if (flags.serverExecutable === false) blockedBy.push("Server executable = false.");

  const liveExecutionOn =
    flags.autotrade &&
    !flags.emergencyStop &&
    flags.mt5Connected &&
    (modeLabel === "DEMO" || (modeLabel === "REAL" && flags.liveEnable));

  let banner: string;
  if (modeLabel === "REAL" && !flags.liveEnable) {
    banner = "REAL ACCOUNT DETECTED — LIVE EXECUTION DISABLED";
  } else if (modeLabel === "DEMO") {
    banner = flags.autotrade
      ? "DEMO ACCOUNT — AUTO EXECUTION AVAILABLE"
      : "DEMO ACCOUNT — AUTO EXECUTION OFF";
  } else if (modeLabel === "REAL" && flags.liveEnable) {
    banner = liveExecutionOn
      ? "REAL ACCOUNT — LIVE EXECUTION ENABLED"
      : "REAL ACCOUNT — LIVE ENABLE ON, menunggu gate lain";
  } else {
    banner = `${modeLabel} — execution blocked`;
  }

  const executionReady =
    liveExecutionOn &&
    flags.riskAllowed !== false &&
    flags.serverExecutable !== false &&
    blockedBy.length === 0;

  return {
    accountModeLabel: modeLabel,
    liveEnableLabel: flags.liveEnable ? "ON" : "OFF",
    liveExecutionLabel: liveExecutionOn ? "ON" : "OFF",
    mt5Label: flags.mt5Connected ? "CONNECTED" : "DISCONNECTED",
    executionLabel: executionReady ? "READY" : "BLOCKED",
    banner,
    blockedBy,
  };
}

/** Verifikasi snapshot akun cukup untuk REAL audit trail. */
export function verifyAccountSnapshot(snap: AccountSnapshot): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (snap.mode !== "demo" && snap.mode !== "real") {
    reasons.push(`Account mode "${snap.mode}" tidak valid untuk eksekusi.`);
  }
  if (snap.login == null || !(snap.login > 0)) {
    reasons.push("Account login tidak terbaca dari MT5.");
  }
  return { ok: reasons.length === 0, reasons };
}
