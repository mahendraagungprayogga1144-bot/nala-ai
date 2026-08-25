/**
 * XAU market session gate (UTC / broker time).
 * Rough window: closed Saturday; Friday late; Sunday early.
 * DEMO dan REAL memakai aturan yang sama.
 */

import type { RiskCheck } from "../types";

export function checkMarketSession(
  brokerTimeSec: number | null,
  nowMs = Date.now(),
): RiskCheck {
  const ms = brokerTimeSec != null && Number.isFinite(brokerTimeSec)
    ? brokerTimeSec * 1000
    : nowMs;
  const d = new Date(ms);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const hour = d.getUTCHours();

  if (day === 6) {
    return { allowed: false, reasons: ["Market closed — Saturday (XAU)."] };
  }
  if (day === 5 && hour >= 21) {
    return { allowed: false, reasons: ["Market closed — Friday late session (XAU)."] };
  }
  if (day === 0 && hour < 22) {
    return { allowed: false, reasons: ["Market closed — Sunday early (XAU)."] };
  }

  return { allowed: true, reasons: [] };
}
