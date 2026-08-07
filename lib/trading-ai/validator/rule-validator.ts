/**
 * AI Validator — rule checklist before a decision can be "actionable".
 * Does not place orders.
 */

import { HARD_RULES, type TradingAiConfig } from "../config";
import type {
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  RiskCheck,
  TrendAnalysis,
  ValidationResult,
} from "../types";

export function validateRules(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  entry: EntrySignal;
  risk: RiskCheck;
  config: TradingAiConfig;
}): ValidationResult {
  const failed: string[] = [];
  const notes: string[] = [];

  if (HARD_RULES.liveTradingEnabled || HARD_RULES.mt5Enabled) {
    failed.push("Phase 1 forbids liveTrading/mt5 flags being true.");
  }

  if (input.config.useIndicatorsAsPrimary) {
    failed.push("Primary approach must be price_action, not RSI/MACD/EMA.");
  }

  if (input.entry.decision === "BUY" && input.trend.direction !== "bullish") {
    failed.push("BUY only allowed when M5 trend is bullish.");
  }
  if (input.entry.decision === "SELL" && input.trend.direction !== "bearish") {
    failed.push("SELL only allowed when M5 trend is bearish.");
  }

  if (input.entry.decision === "BUY" || input.entry.decision === "SELL") {
    if (!input.pullback.detected) failed.push("Entry without pullback.");
    if (!input.rejection.detected) failed.push("Entry without rejection.");
    if (!input.momentum.alignedWithTrend) failed.push("Entry without momentum alignment.");
    if (!input.risk.allowed) failed.push(...input.risk.reasons);
  }

  notes.push("Rule Validator scaffold — confidence scoring is additive in phase 1.");

  return {
    valid: failed.length === 0,
    confidence: 0, // filled by scoreConfidence
    failedRules: failed,
    notes,
  };
}

/** Heuristic confidence 0–100 (phase 1: conservative). */
export function scoreConfidence(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  validation: Omit<ValidationResult, "confidence"> & { confidence?: number };
}): number {
  if (input.validation.failedRules.length) return 0;

  let score = 0;
  score += Math.round(input.trend.strength * 30);
  if (input.pullback.detected) score += 20;
  if (input.rejection.detected) score += 25;
  if (input.momentum.alignedWithTrend) {
    score += 15 + Math.round(input.momentum.strength * 10);
  }

  return Math.max(0, Math.min(100, score));
}

export function runAiValidator(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  entry: EntrySignal;
  risk: RiskCheck;
  config: TradingAiConfig;
}): ValidationResult {
  const base = validateRules(input);
  const confidence = scoreConfidence({
    trend: input.trend,
    pullback: input.pullback,
    rejection: input.rejection,
    momentum: input.momentum,
    validation: base,
  });
  return { ...base, confidence };
}
