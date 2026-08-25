/**
 * Trading AI Brain — orchestrator.
 * Combines brain + risk + validator into BUY | SELL | WAIT | CLOSE.
 *
 * Guarantees:
 * - Server itself never calls a broker API. EA is the only executor.
 * - executable=true hanya lewat execution-gate (akun demo|real + env aktif).
 * - Default accountMode "unknown" => executable false (fail-closed).
 * - Audit log attached to every decision.
 */

import {
  analyzeSupportResistance,
  analyzeTrend,
  decideEntry,
  decideExit,
} from "./brain";
import { detectSequencedSetup } from "./brain/setup-sequence";
import { buildDecisionAudit } from "./audit";
import {
  DEFAULT_TRADING_AI_CONFIG,
  HARD_RULES,
  mergeTradingAiConfig,
  type TradingAiConfig,
} from "./config";
import { evaluateExecutionGate, type AccountMode } from "./execution-gate";
import {
  checkFloatingRisk,
  checkPositionLimit,
  checkSpread,
} from "./risk";
import type { BrainContext, TradeDecision, TradingDecisionResult } from "./types";
import { runAiValidator } from "./validator";

export type DecideOptions = {
  config?: Parameters<typeof mergeTradingAiConfig>[0];
  /** Optional account balance for floating-risk gate. */
  balance?: number | null;
  /**
   * Mode akun yang dilaporkan EA. Default "unknown" supaya semua pemanggil
   * lama (dashboard, backtest) tetap dapat executable=false.
   */
  accountMode?: AccountMode;
  /** Override env kill switch. Default: TRADING_AI_EA_SIGNALS === "1". */
  executionEnabled?: boolean;
};

export function decideTradingAction(
  ctx: BrainContext,
  opts: DecideOptions = {},
): TradingDecisionResult {
  const config: TradingAiConfig = mergeTradingAiConfig(opts.config ?? DEFAULT_TRADING_AI_CONFIG);
  const reasons: string[] = [];
  const generatedAt = Date.now();
  const accountMode: AccountMode = opts.accountMode ?? "unknown";

  if (HARD_RULES.liveTradingEnabled || HARD_RULES.mt5Enabled) {
    reasons.push("Misconfigured: server liveTrading/mt5 order flags must stay disabled.");
  }

  const trend = analyzeTrend(ctx.m5Candles, config);
  const supportResistance = analyzeSupportResistance(
    ctx.m5Candles,
    config,
    ctx.market.bid,
  );

  const setup = detectSequencedSetup(
    ctx.m1Candles,
    trend.direction,
    config,
    supportResistance,
  );
  const {
    pullback,
    rejection,
    momentum,
    entryDistance,
    nearLevel,
    m1State,
    setupKind,
    strongRejection,
    breakoutContinuation,
  } = setup;

  const exit = decideExit({
    positions: ctx.openPositions,
    trend,
    momentum,
    supportResistance,
    marketPrice: ctx.market.bid,
    execution: { accountMode, executionEnabled: opts.executionEnabled },
  });
  const entryPrice = trend.direction === "bearish" ? ctx.market.bid : ctx.market.ask;
  const entry = decideEntry({
    trend,
    pullback,
    rejection,
    momentum,
    supportResistance,
    marketPrice: entryPrice,
    config,
    entryDistance,
    nearLevel,
    setupKind,
    strongRejection,
    breakoutContinuation,
  });

  const spreadOk = checkSpread(ctx.market, config);
  const positionOk = checkPositionLimit(ctx.openPositions, entry.decision, config);
  const floatingOk = checkFloatingRisk(ctx.openPositions, opts.balance ?? null, config);

  const riskReasons = [...spreadOk.reasons, ...positionOk.reasons, ...floatingOk.reasons];
  const risk = {
    allowed: spreadOk.allowed && positionOk.allowed && floatingOk.allowed,
    reasons: riskReasons,
  };

  const validation = runAiValidator({
    trend,
    pullback,
    rejection,
    momentum,
    entry,
    risk,
    config,
    nearLevel,
    entryDistance,
  });

  let decision: TradeDecision = "WAIT";

  if (exit.decision === "CLOSE") {
    decision = "CLOSE";
    reasons.push(exit.reason);
  } else if (
    (entry.decision === "BUY" || entry.decision === "SELL") &&
    risk.allowed &&
    validation.valid &&
    validation.confidence >= config.brain.minConfidenceToEnter &&
    entry.entryQuality !== "WEAK"
  ) {
    decision = entry.decision;
    reasons.push(entry.reason);
  } else {
    decision = "WAIT";
    reasons.push(entry.reason || "Setup not valid — WAIT.");
    if (!validation.valid) reasons.push(...validation.failedRules);
    if (
      validation.valid &&
      risk.allowed &&
      (entry.decision === "BUY" || entry.decision === "SELL") &&
      (validation.confidence < config.brain.minConfidenceToEnter ||
        entry.entryQuality === "WEAK")
    ) {
      reasons.push(
        entry.entryQuality === "WEAK"
          ? `ENTRY_QUALITY=WEAK — WAIT.`
          : `Confidence ${validation.confidence} < min ${config.brain.minConfidenceToEnter}.`,
      );
    }
  }

  reasons.push(...trend.notes.filter(Boolean).slice(0, 2));
  if (pullback.notes[0]) reasons.push(pullback.notes[0]);

  const execution = evaluateExecutionGate({
    decision,
    confidence: validation.confidence,
    accountMode,
    validationValid: validation.valid,
    riskAllowed: risk.allowed,
    executionEnabled: opts.executionEnabled,
    configMinConfidence: config.brain.minConfidenceToEnter,
  });

  if (!execution.executable && decision !== "WAIT") {
    reasons.push(...execution.blockedBy);
  }

  const shell = {
    decision,
    symbol: ctx.symbol,
    confidence: validation.confidence,
    reasons,
    trend,
    supportResistance,
    pullback,
    rejection,
    momentum,
    m1State,
    entryDistance: entry.entryDistance ?? entryDistance,
    entryQuality: entry.entryQuality,
    entry,
    exit,
    risk,
    validation,
    execution,
  };

  const audit = buildDecisionAudit({ ...shell, timestamp: generatedAt });

  return {
    ...shell,
    audit,
    executable: execution.executable,
    generatedAt,
  };
}
