/**
 * Risk — floating P/L gate (placeholder until live account metrics exist).
 */

import type { TradingAiConfig } from "../config";
import type { OpenPosition, RiskCheck } from "../types";

export function checkFloatingRisk(
  positions: OpenPosition[],
  /** Account balance placeholder — null = skip numeric gate. */
  balance: number | null,
  config: TradingAiConfig,
): RiskCheck {
  if (!positions.length || balance == null || balance <= 0) {
    return { allowed: true, reasons: [] };
  }

  const floating = positions.reduce((s, p) => s + p.floatingPnl, 0);
  const riskPct = Math.abs(Math.min(0, floating)) / balance * 100;

  if (floating < 0 && riskPct >= config.risk.maxFloatingRiskPct) {
    return {
      allowed: false,
      reasons: [
        `Floating loss ${riskPct.toFixed(2)}% >= max ${config.risk.maxFloatingRiskPct}%. Block new risk / prefer manage exit.`,
      ],
    };
  }

  return { allowed: true, reasons: [] };
}
