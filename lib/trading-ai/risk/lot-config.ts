/**
 * Risk — lot sizing helpers (config-driven, no account equity feed yet).
 */

import type { TradingAiConfig } from "../config";

export function resolveLot(
  config: TradingAiConfig,
  requestedLot?: number | null,
): { lot: number; ok: boolean; reason?: string } {
  const lot = requestedLot ?? config.risk.defaultLot;
  if (lot <= 0) {
    return { lot: config.risk.defaultLot, ok: false, reason: "Lot must be > 0." };
  }
  if (lot > config.risk.maxLot) {
    return {
      lot: config.risk.maxLot,
      ok: false,
      reason: `Lot ${lot} exceeds max ${config.risk.maxLot}.`,
    };
  }
  return { lot, ok: true };
}
