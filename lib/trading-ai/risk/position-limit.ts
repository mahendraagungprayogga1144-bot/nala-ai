/**
 * Risk — position limit (max 1, no averaging / martingale / grid / hedge).
 */

import { HARD_RULES, type TradingAiConfig } from "../config";
import type { OpenPosition, RiskCheck, TradeDecision } from "../types";

export function checkPositionLimit(
  positions: OpenPosition[],
  intended: TradeDecision,
  config: TradingAiConfig,
): RiskCheck {
  const reasons: string[] = [];
  const max = Math.min(config.risk.maxOpenPositions, HARD_RULES.maxOpenPositions);

  if (HARD_RULES.allowAveraging || HARD_RULES.allowMartingale || HARD_RULES.allowGrid || HARD_RULES.allowHedge) {
    reasons.push("Hard rule misconfigured — averaging/martingale/grid/hedge must stay disabled.");
    return { allowed: false, reasons };
  }

  if ((intended === "BUY" || intended === "SELL") && positions.length >= max) {
    reasons.push(`Max ${max} open position(s). No new entry while a trade is open.`);
    return { allowed: false, reasons };
  }

  // No hedge: block opposite side while one is open (belt + suspenders with max=1).
  if (positions.length === 1 && (intended === "BUY" || intended === "SELL")) {
    const open = positions[0];
    if (open.side !== intended) {
      reasons.push("Hedge forbidden — close or wait; do not open opposite side.");
      return { allowed: false, reasons };
    }
    reasons.push("Averaging forbidden — already in same direction.");
    return { allowed: false, reasons };
  }

  return { allowed: true, reasons: [] };
}
