/**
 * Exit Decision Engine — HOLD | CLOSE.
 * - M5 flip only exits if M1 also supports reversal
 * - Profit protection by floating PnL bands + M1 momentum weaken
 */

import { evaluateExecutionGate, type AccountMode } from "../execution-gate";
import type {
  ExitSignal,
  MomentumAnalysis,
  OpenPosition,
  TrendAnalysis,
} from "../types";

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

/** Rough XAU: ~$0.10 ≈ 1 pip display; floatingPnl is USD on lot×100. */
function estimatePips(pos: OpenPosition): number {
  // Prefer price distance if we only have pnl: for 0.01 lot, $1 ≈ 1 pip; for 0.1 lot $10 ≈ 1 pip.
  const lot = Math.max(pos.lot, 0.01);
  const usdPerPip = lot * 100 * 0.1; // $0.10 move * 100 oz * lot
  if (usdPerPip <= 0) return 0;
  return pos.floatingPnl / usdPerPip;
}

export function decideExit(input: {
  positions: OpenPosition[];
  trend: TrendAnalysis;
  momentum?: MomentumAnalysis | null;
  execution?: ExitExecutionContext;
}): ExitSignal {
  const { positions, trend, momentum, execution } = input;

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
  const mom = momentum ?? null;
  const m1AgainstBuy =
    mom != null &&
    (mom.direction === "bearish" || (!mom.alignedWithTrend && mom.strength < 0.45));
  const m1AgainstSell =
    mom != null &&
    (mom.direction === "bullish" || (!mom.alignedWithTrend && mom.strength < 0.45));
  const m1SupportsBull =
    mom != null && (mom.direction === "bullish" || (mom.alignedWithTrend && mom.strength >= 0.45));
  const m1SupportsBear =
    mom != null && (mom.direction === "bearish" || (mom.alignedWithTrend && mom.strength >= 0.45));

  // M5 flip + M1 reversal confirmation
  if (pos.side === "BUY" && trend.direction === "bearish" && m1SupportsBear) {
    return {
      decision: "CLOSE",
      reason: "TREND_INVALIDATED — M5 bearish + M1 supports reversal against BUY.",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }
  if (pos.side === "SELL" && trend.direction === "bullish" && m1SupportsBull) {
    return {
      decision: "CLOSE",
      reason: "TREND_INVALIDATED — M5 bullish + M1 supports reversal against SELL.",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }

  const pnl = pos.floatingPnl ?? 0;
  const pips = estimatePips(pos);

  // Profit protection bands
  if (pnl > 0 && mom) {
    const against = pos.side === "BUY" ? m1AgainstBuy : m1AgainstSell;
    const strongWith =
      pos.side === "BUY"
        ? mom.direction === "bullish" && mom.strength >= 0.7
        : mom.direction === "bearish" && mom.strength >= 0.7;

    if (pips >= 20 && against) {
      return {
        decision: "CLOSE",
        reason: `PROFIT_PROTECT — ~${pips.toFixed(0)} pips + M1 momentum melemah. Amankan profit.`,
        positionId: pos.id,
        executable: closeGate.executable,
        executionBlockedBy: closeGate.blockedBy,
      };
    }
    if (pips >= 10 && against && !strongWith) {
      return {
        decision: "CLOSE",
        reason: `PROFIT_PROTECT — ~${pips.toFixed(0)} pips + M1 weakening. Close cepat.`,
        positionId: pos.id,
        executable: closeGate.executable,
        executionBlockedBy: closeGate.blockedBy,
      };
    }
    if (against && mom.strength < 0.35) {
      return {
        decision: "CLOSE",
        reason: "MOMENTUM_LOST — protect floating profit (M1 weakening/against).",
        positionId: pos.id,
        executable: closeGate.executable,
        executionBlockedBy: closeGate.blockedBy,
      };
    }
  }

  return {
    decision: "HOLD",
    reason: `Hold ${pos.side} — M5 ${trend.regime}, M1 momentum belum invalid.`,
    positionId: pos.id,
    executable: false,
    executionBlockedBy: HOLD_NOT_EXECUTABLE,
  };
}
