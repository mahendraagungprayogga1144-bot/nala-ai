/**
 * Exit Decision Engine — HOLD | CLOSE.
 * CLOSE when M5 bias flips against the open side.
 *
 * Eksekusi CLOSE tetap harus lewat execution gate (demo|real).
 * HOLD tidak pernah executable.
 */

import { evaluateExecutionGate, type AccountMode } from "../execution-gate";
import type { ExitSignal, OpenPosition, TrendAnalysis } from "../types";

export type ExitExecutionContext = {
  accountMode: AccountMode;
  executionEnabled?: boolean;
};

function gateForClose(ctx: ExitExecutionContext | undefined) {
  if (!ctx) {
    return {
      executable: false,
      blockedBy: ["Tidak ada konteks akun — CLOSE tidak executable (fail-closed)."],
    };
  }
  // CLOSE mengurangi risiko, jadi validator/risk entry tidak dipakai sebagai blocker.
  const gate = evaluateExecutionGate({
    decision: "CLOSE",
    confidence: 100,
    accountMode: ctx.accountMode,
    validationValid: true,
    riskAllowed: true,
    executionEnabled: ctx.executionEnabled,
  });
  return { executable: gate.executable, blockedBy: gate.blockedBy };
}

const HOLD_NOT_EXECUTABLE = ["Exit decision HOLD tidak pernah executable."];

export function decideExit(input: {
  positions: OpenPosition[];
  trend: TrendAnalysis;
  execution?: ExitExecutionContext;
}): ExitSignal {
  const { positions, trend, execution } = input;

  if (!positions.length) {
    return {
      decision: "HOLD",
      reason: "No open position.",
      positionId: null,
      executable: false,
      executionBlockedBy: HOLD_NOT_EXECUTABLE,
    };
  }

  const pos = positions[0];
  const closeGate = gateForClose(execution);

  if (pos.side === "BUY" && trend.direction === "bearish") {
    return {
      decision: "CLOSE",
      reason: "M5 flipped bearish against open BUY — close (no hedge).",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }
  if (pos.side === "SELL" && trend.direction === "bullish") {
    return {
      decision: "CLOSE",
      reason: "M5 flipped bullish against open SELL — close (no hedge).",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }

  return {
    decision: "HOLD",
    reason: `Hold ${pos.side} — M5 still ${trend.direction}.`,
    positionId: pos.id,
    executable: false,
    executionBlockedBy: HOLD_NOT_EXECUTABLE,
  };
}
