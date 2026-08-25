/**
 * Exit Decision Engine — HOLD | CLOSE.
 * Uses M1 momentum, M5 regime, profit bands, reversal.
 * M5 flip alone is not enough — M1 must support reversal.
 *
 * Profit bands (approx pips):
 *  +10: strong with → HOLD; weakening → CLOSE
 *  +20: weakening → CLOSE
 *  +30: very strong → HOLD (trail/let run); else protect
 */

import { evaluateExecutionGate, type AccountMode } from "../execution-gate";
import type {
  ExitSignal,
  MomentumAnalysis,
  OpenPosition,
  SupportResistanceAnalysis,
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

/** Rough XAU: floatingPnl USD → approx pips from lot. */
function estimatePips(pos: OpenPosition): number {
  const lot = Math.max(pos.lot, 0.01);
  const usdPerPip = lot * 100 * 0.1;
  if (usdPerPip <= 0) return 0;
  return pos.floatingPnl / usdPerPip;
}

export function decideExit(input: {
  positions: OpenPosition[];
  trend: TrendAnalysis;
  momentum?: MomentumAnalysis | null;
  supportResistance?: SupportResistanceAnalysis | null;
  marketPrice?: number | null;
  execution?: ExitExecutionContext;
}): ExitSignal {
  const { positions, trend, momentum, supportResistance, marketPrice, execution } = input;

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
  const m1ReversalBuy =
    mom != null && mom.direction === "bearish" && mom.strength >= 0.45;
  const m1ReversalSell =
    mom != null && mom.direction === "bullish" && mom.strength >= 0.45;

  // Valid M1 reversal against position → CLOSE (even small profit/flat).
  if (pos.side === "BUY" && m1ReversalBuy && (pos.floatingPnl ?? 0) >= 0) {
    return {
      decision: "CLOSE",
      reason: "M1_REVERSAL — bearish momentum valid against BUY. CLOSE.",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }
  if (pos.side === "SELL" && m1ReversalSell && (pos.floatingPnl ?? 0) >= 0) {
    return {
      decision: "CLOSE",
      reason: "M1_REVERSAL — bullish momentum valid against SELL. CLOSE.",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }

  // M5 flip + M1 reversal confirmation (not M5 alone).
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

  // Approach opposing S/R with weakening momentum → protect.
  if (
    pnl > 0 &&
    mom &&
    marketPrice != null &&
    supportResistance &&
    ((pos.side === "BUY" &&
      supportResistance.nearestResistance != null &&
      Math.abs(marketPrice - supportResistance.nearestResistance) <= 0.8 &&
      m1AgainstBuy) ||
      (pos.side === "SELL" &&
        supportResistance.nearestSupport != null &&
        Math.abs(marketPrice - supportResistance.nearestSupport) <= 0.8 &&
        m1AgainstSell))
  ) {
    return {
      decision: "CLOSE",
      reason: "NEAR_OPPOSITE_SR — profit + approaching opposing level + M1 weaken. CLOSE.",
      positionId: pos.id,
      executable: closeGate.executable,
      executionBlockedBy: closeGate.blockedBy,
    };
  }

  // Profit protection bands
  if (pnl > 0 && mom) {
    const against = pos.side === "BUY" ? m1AgainstBuy : m1AgainstSell;
    const strongWith =
      pos.side === "BUY"
        ? mom.direction === "bullish" && mom.strength >= 0.7
        : mom.direction === "bearish" && mom.strength >= 0.7;
    const veryStrong =
      pos.side === "BUY"
        ? mom.direction === "bullish" && mom.strength >= 0.85
        : mom.direction === "bearish" && mom.strength >= 0.85;

    // +30 pips + very strong → HOLD / trail (take what market gives).
    if (pips >= 30 && veryStrong) {
      return {
        decision: "HOLD",
        reason: `Hold ${pos.side} — ~${pips.toFixed(0)} pips + momentum sangat kuat. Trail / biarkan jalan.`,
        positionId: pos.id,
        executable: false,
        executionBlockedBy: HOLD_NOT_EXECUTABLE,
      };
    }

    if (pips >= 20 && against) {
      return {
        decision: "CLOSE",
        reason: `PROFIT_PROTECT — ~${pips.toFixed(0)} pips + M1 momentum melemah. Amankan profit.`,
        positionId: pos.id,
        executable: closeGate.executable,
        executionBlockedBy: closeGate.blockedBy,
      };
    }

    // +10: strong with → HOLD; weakening → CLOSE
    if (pips >= 10 && against && !strongWith) {
      return {
        decision: "CLOSE",
        reason: `PROFIT_PROTECT — ~${pips.toFixed(0)} pips + M1 weakening. Close cepat.`,
        positionId: pos.id,
        executable: closeGate.executable,
        executionBlockedBy: closeGate.blockedBy,
      };
    }

    if (pips >= 10 && strongWith) {
      return {
        decision: "HOLD",
        reason: `Hold ${pos.side} — ~${pips.toFixed(0)} pips + momentum masih kuat.`,
        positionId: pos.id,
        executable: false,
        executionBlockedBy: HOLD_NOT_EXECUTABLE,
      };
    }

    if (against && mom.strength < 0.35 && pips >= 5) {
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
