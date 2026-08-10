/**
 * Auditable confidence score — rule/feature based only.
 * Claude must never set or alter these points.
 */

import type { TradingAiConfig } from "../config";
import type {
  ConfidenceBreakdown,
  ConfidenceFeature,
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  RiskCheck,
  TrendAnalysis,
  ValidationResult,
} from "../types";
import { HARD_RULES } from "../config";

export function buildConfidenceFeatures(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  entry: EntrySignal;
  risk: RiskCheck;
  config: TradingAiConfig;
}): ConfidenceFeature[] {
  const { trend, pullback, rejection, momentum, entry, risk, config } = input;
  const features: ConfidenceFeature[] = [];

  const biasClear = trend.direction === "bullish" || trend.direction === "bearish";
  features.push({
    id: "m5_bias_clear",
    label: "M5 bias clear (bullish|bearish)",
    passed: biasClear,
    points: biasClear ? Math.round(trend.strength * 30) : 0,
    detail: `direction=${trend.direction} strength=${trend.strength.toFixed(2)}`,
  });

  features.push({
    id: "m1_pullback",
    label: "M1 pullback into S/R",
    passed: pullback.detected,
    points: pullback.detected ? 20 : 0,
    detail: `detected=${pullback.detected} depth=${pullback.depth.toFixed(3)} level=${pullback.nearLevel ?? "null"}`,
  });

  const depthInBand =
    pullback.detected &&
    pullback.depth >= config.brain.pullbackMinDepth &&
    pullback.depth <= Math.max(config.brain.pullbackMaxDepth, 1);
  features.push({
    id: "pullback_depth_band",
    label: "Pullback depth in configured band",
    passed: depthInBand,
    points: depthInBand ? 5 : 0,
    detail: `depth=${pullback.depth.toFixed(3)} band=[${config.brain.pullbackMinDepth},${config.brain.pullbackMaxDepth}]`,
  });

  features.push({
    id: "m1_rejection",
    label: "M1 rejection at level (OHLC)",
    passed: rejection.detected,
    points: rejection.detected ? 25 : 0,
    detail: `detected=${rejection.detected} side=${rejection.side ?? "null"} at=${rejection.atPrice ?? "null"}`,
  });

  const rejAligned =
    rejection.detected &&
    ((trend.direction === "bullish" && rejection.side === "bullish") ||
      (trend.direction === "bearish" && rejection.side === "bearish"));
  features.push({
    id: "rejection_aligns_bias",
    label: "Rejection side aligns with M5 bias",
    passed: !!rejAligned,
    points: rejAligned ? 5 : 0,
    detail: `trend=${trend.direction} rejectionSide=${rejection.side ?? "null"}`,
  });

  features.push({
    id: "m1_momentum",
    label: "M1 momentum resumes with M5",
    passed: momentum.alignedWithTrend,
    points: momentum.alignedWithTrend ? 15 + Math.round(momentum.strength * 10) : 0,
    detail: `aligned=${momentum.alignedWithTrend} strength=${momentum.strength.toFixed(2)}`,
  });

  features.push({
    id: "risk_clear",
    label: "Hard risk checks clear",
    passed: risk.allowed,
    points: risk.allowed ? 5 : 0,
    detail: risk.allowed ? "ok" : risk.reasons.join("; ") || "blocked",
  });

  const directionOk =
    (entry.decision === "BUY" && trend.direction === "bullish") ||
    (entry.decision === "SELL" && trend.direction === "bearish") ||
    entry.decision === "WAIT";
  features.push({
    id: "entry_direction_gate",
    label: "Entry respects M5 direction gate",
    passed: directionOk,
    points: directionOk && entry.decision !== "WAIT" ? 5 : 0,
    detail: `entry=${entry.decision} trend=${trend.direction}`,
  });

  return features;
}

export function scoreFromFeatures(features: ConfidenceFeature[]): ConfidenceBreakdown {
  const score = Math.max(
    0,
    Math.min(
      100,
      features.reduce((s, f) => s + (f.passed ? f.points : 0), 0),
    ),
  );
  const maxPossible = 100;
  return { score, maxPossible, features };
}

export function validateRules(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  entry: EntrySignal;
  risk: RiskCheck;
  config: TradingAiConfig;
}): Omit<ValidationResult, "confidence" | "breakdown"> & { breakdown: ConfidenceBreakdown } {
  const failed: string[] = [];
  const passed: string[] = [];

  if (HARD_RULES.liveTradingEnabled || HARD_RULES.mt5Enabled) {
    failed.push("Hard rule: liveTrading/mt5 must stay disabled.");
  } else {
    passed.push("Hard rule: no live trading / mt5 execution flags.");
  }

  if (HARD_RULES.MAX_POSITION !== 1 || HARD_RULES.NO_AVERAGING !== true) {
    failed.push("Hard rule misconfigured: MAX_POSITION/NO_AVERAGING.");
  } else {
    passed.push("Hard rule: MAX_POSITION=1, NO_AVERAGING.");
  }

  if (!HARD_RULES.NO_MARTINGALE || !HARD_RULES.NO_GRID || !HARD_RULES.NO_HEDGE) {
    failed.push("Hard rule misconfigured: NO_MARTINGALE/NO_GRID/NO_HEDGE.");
  } else {
    passed.push("Hard rule: NO_MARTINGALE, NO_GRID, NO_HEDGE.");
  }

  if (input.config.useIndicatorsAsPrimary) {
    failed.push("Primary approach must be price_action.");
  } else {
    passed.push("Primary approach: price_action.");
  }

  if (input.entry.decision === "BUY" && input.trend.direction !== "bullish") {
    failed.push("BUY only when M5 bullish.");
  }
  if (input.entry.decision === "SELL" && input.trend.direction !== "bearish") {
    failed.push("SELL only when M5 bearish.");
  }

  if (input.entry.decision === "BUY" || input.entry.decision === "SELL") {
    if (!input.pullback.detected) failed.push("Entry without pullback.");
    else passed.push("Pullback detected.");
    if (!input.rejection.detected) failed.push("Entry without rejection.");
    else passed.push("Rejection detected.");
    if (!input.momentum.alignedWithTrend) failed.push("Entry without momentum alignment.");
    else passed.push("Momentum aligned with M5.");
  }

  // Risk dicatat terlepas dari keputusan entry. Sebelumnya hanya dicatat saat
  // entry sudah BUY/SELL, sehingga blokir spread tidak pernah muncul di audit
  // dan penyebab WAIT jadi tak terlihat.
  if (!input.risk.allowed) failed.push(...input.risk.reasons);
  else passed.push("Risk checks allowed.");

  if (input.trend.direction === "sideways" || input.trend.direction === "unknown") {
    if (input.entry.decision !== "WAIT") {
      failed.push("Sideways/unknown M5 must WAIT.");
    } else {
      passed.push("Sideways/unknown → WAIT enforced.");
    }
  }

  const features = buildConfidenceFeatures(input);
  const breakdown = scoreFromFeatures(features);

  return {
    valid: failed.length === 0,
    failedRules: failed,
    passedRules: passed,
    notes: ["Confidence from auditable rule features only — never Claude."],
    breakdown,
  };
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
  return {
    ...base,
    confidence: base.breakdown.score,
  };
}

/** @deprecated use buildConfidenceFeatures + scoreFromFeatures */
export function scoreConfidence(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  validation: { failedRules: string[] };
  entry?: EntrySignal;
  risk?: RiskCheck;
  config?: TradingAiConfig;
}): number {
  if (input.validation.failedRules.length && input.entry && input.risk && input.config) {
    // keep behavior: zero only when entry path failed hard — features still score for WAIT
  }
  if (!input.entry || !input.risk || !input.config) {
    let score = 0;
    score += Math.round(input.trend.strength * 30);
    if (input.pullback.detected) score += 20;
    if (input.rejection.detected) score += 25;
    if (input.momentum.alignedWithTrend) score += 15 + Math.round(input.momentum.strength * 10);
    return Math.max(0, Math.min(100, score));
  }
  return scoreFromFeatures(
    buildConfidenceFeatures({
      trend: input.trend,
      pullback: input.pullback,
      rejection: input.rejection,
      momentum: input.momentum,
      entry: input.entry,
      risk: input.risk,
      config: input.config,
    }),
  ).score;
}
