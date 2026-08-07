/**
 * Risk — spread filter.
 */

import type { TradingAiConfig } from "../config";
import type { MarketSnapshot, RiskCheck } from "../types";

export function checkSpread(
  market: MarketSnapshot,
  config: TradingAiConfig,
): RiskCheck {
  if (market.spread > config.risk.maxSpreadPoints) {
    return {
      allowed: false,
      reasons: [
        `Spread ${market.spread} > max ${config.risk.maxSpreadPoints} points — WAIT.`,
      ],
    };
  }
  return { allowed: true, reasons: [] };
}
