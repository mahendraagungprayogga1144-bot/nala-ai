/**
 * Trading AI Brain — orchestrator.
 * Combines brain + risk + validator into BUY | SELL | WAIT | CLOSE.
 *
 * Guarantees:
 * - Server never places broker orders (executable stays false).
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
};

export function decideTradingAction(
  ctx: BrainContext,
  opts: DecideOptions = {},
): TradingDecisionResult {
  const config: TradingAiConfig = mergeTradingAiConfig(opts.config ?? DEFAULT_TRADING_AI_CONFIG);
  const reasons: string[] = [];
  const generatedAt = Date.now();

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
  const { pullback, rejection, momentum } = setup;

  const exit = decideExit({ positions: ctx.openPositions, trend });
  const entryPrice = trend.direction === "bearish" ? ctx.market.bid : ctx.market.ask;
  const entry = decideEntry({
    trend,
    pullback,
    rejection,
    momentum,
    supportResistance,
    marketPrice: entryPrice,
    config,
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
  });

  let decision: TradeDecision = "WAIT";

  if (exit.decision === "CLOSE") {
    decision = "CLOSE";
    reasons.push(exit.reason);
  } else if (
    (entry.decision === "BUY" || entry.decision === "SELL") &&
    risk.allowed &&
    validation.valid &&
    validation.confidence >= config.brain.minConfidenceToEnter
  ) {
    decision = entry.decision;
    reasons.push(entry.reason);
  } else {
    decision = "WAIT";
    reasons.push(entry.reason || "Setup not valid — WAIT.");
    if (!risk.allowed) reasons.push(...risk.reasons);
    if (!validation.valid) reasons.push(...validation.failedRules);
    if (
      validation.valid &&
      risk.allowed &&
      (entry.decision === "BUY" || entry.decision === "SELL") &&
      validation.confidence < config.brain.minConfidenceToEnter
    ) {
      reasons.push(
        `Confidence ${validation.confidence} < min ${config.brain.minConfidenceToEnter}.`,
      );
    }
  }

  reasons.push(...trend.notes.filter(Boolean).slice(0, 2));
  if (pullback.notes[0]) reasons.push(pullback.notes[0]);

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
    entry,
    exit,
    risk,
    validation,
  };

  const audit = buildDecisionAudit({ ...shell, timestamp: generatedAt });

  return {
    ...shell,
    audit,
    executable: false,
    generatedAt,
  };
}
