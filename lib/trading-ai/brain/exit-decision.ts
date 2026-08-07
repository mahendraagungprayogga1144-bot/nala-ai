/**
 * Exit Decision Engine — when to CLOSE an open position.
 * Phase 1 stub: never auto-closes (keeps WAIT).
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

  // Hard rule: max 1 position — still only advise CLOSE when logic says so.
  const pos = positions[0];

  // TODO(phase-2): opposite structure break, SL/TP hit simulation, invalidation of bias.
  void trend;
  return {
    decision: "WAIT",
    reason: `Exit scaffold — holding ${pos.side} ${pos.id} until exit rules are implemented.`,
    positionId: pos.id,
  };
}
