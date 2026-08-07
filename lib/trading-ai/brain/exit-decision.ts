/**
 * Exit Decision Engine — CLOSE when M5 bias flips against the open side.
 * Still advisory only (orchestrator sets executable: false).
 */

import type { ExitSignal, OpenPosition, TrendAnalysis } from "../types";

export function decideExit(input: {
  positions: OpenPosition[];
  trend: TrendAnalysis;
}): ExitSignal {
  const { positions, trend } = input;

  if (!positions.length) {
    return {
      decision: "WAIT",
      reason: "No open position.",
      positionId: null,
    };
  }

  const pos = positions[0];

  if (pos.side === "BUY" && trend.direction === "bearish") {
    return {
      decision: "CLOSE",
      reason: "M5 flipped bearish against open BUY — close (no hedge).",
      positionId: pos.id,
    };
  }
  if (pos.side === "SELL" && trend.direction === "bullish") {
    return {
      decision: "CLOSE",
      reason: "M5 flipped bullish against open SELL — close (no hedge).",
      positionId: pos.id,
    };
  }

  return {
    decision: "WAIT",
    reason: `Hold ${pos.side} — M5 still ${trend.direction}.`,
    positionId: pos.id,
  };
}
