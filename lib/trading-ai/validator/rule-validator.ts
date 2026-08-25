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
  nearLevel?: boolean;
  entryDistance?: number | null;
}): ConfidenceFeature[] {
  const {
    trend,
    pullback,
    rejection,
    momentum,
    entry,
    risk,
    config,
    nearLevel = false,
    entryDistance = null,
  } = input;
  const features: ConfidenceFeature[] = [];

  const biasClear = trend.direction === "bullish" || trend.direction === "bearish";
  const rangeBox = trend.direction === "sideways";
  features.push({
    id: "m5_bias_clear",
    label: rangeBox ? "M5 RANGE (edge scalp)" : "M5 bias clear (TRENDING)",
    passed: biasClear || rangeBox,
    points: biasClear
      ? Math.round(trend.strength * 28)
      : rangeBox
        ? Math.max(8, Math.round(trend.strength * 16))
        : 0,
    detail: `regime=${trend.regime} direction=${trend.direction} strength=${trend.strength.toFixed(2)}`,
  });

  features.push({
    id: "m1_pullback",
    label: "M1 pullback toward entry level",
    passed: pullback.detected,
    points: pullback.detected ? 18 : 0,
    detail: `detected=${pullback.detected} depth=${pullback.depth.toFixed(3)} level=${pullback.nearLevel ?? "null"}`,
  });

  const depthInBand =
    pullback.detected &&
    pullback.depth >= config.brain.pullbackMinDepth &&
    pullback.depth <= config.brain.pullbackMaxDepth;
  features.push({
    id: "pullback_depth_band",
    label: "Pullback depth in configured band",
    passed: depthInBand,
    points: depthInBand ? 5 : 0,
    detail: `depth=${pullback.depth.toFixed(3)} band=[${config.brain.pullbackMinDepth},${config.brain.pullbackMaxDepth}]`,
  });

  features.push({
    id: "m1_rejection",
    label: "M1 rejection / failed break at level",
    passed: rejection.detected,
    points: rejection.detected ? 22 : 0,
    detail: `detected=${rejection.detected} side=${rejection.side ?? "null"} at=${rejection.atPrice ?? "null"}`,
  });

  features.push({
    id: "near_sr_level",
    label: "Price near S/R or working level",
    passed: nearLevel,
    points: nearLevel ? 10 : 0,
    detail: `nearLevel=${nearLevel} entryDistance=${entryDistance ?? "null"}`,
  });

  const rejAligned =
    rejection.detected &&
    (rejection.side === "bullish" || rejection.side === "bearish");
  features.push({
    id: "rejection_aligns_bias",
    label: "M1 setup side clear (BUY dip / SELL top)",
    passed: !!rejAligned,
    points: rejAligned ? 5 : 0,
    detail: `trend=${trend.direction} rejectionSide=${rejection.side ?? "null"}`,
  });

  features.push({
    id: "m1_momentum",
    label: "M1 momentum resumed with bias",
    passed: momentum.alignedWithTrend,
    points: momentum.alignedWithTrend ? 12 + Math.round(momentum.strength * 10) : 0,
    detail: `aligned=${momentum.alignedWithTrend} strength=${momentum.strength.toFixed(2)} dir=${momentum.direction}`,
  });

  features.push({
    id: "risk_clear",
    label: "Hard risk checks clear",
    passed: risk.allowed,
    points: risk.allowed ? 5 : 0,
    detail: risk.allowed ? "ok" : risk.reasons.join("; ") || "blocked",
  });

  const consistencyOk = !entry.consistencyFail;
  features.push({
    id: "brain_consistency",
    label: "No BRAIN_CONSISTENCY_FAIL",
    passed: consistencyOk,
    points: consistencyOk ? 5 : 0,
    detail: `consistencyFail=${entry.consistencyFail}`,
  });

  const directionOk =
    (entry.decision === "BUY" && rejection.side === "bullish") ||
    (entry.decision === "SELL" && rejection.side === "bearish") ||
    entry.decision === "WAIT";
  features.push({
    id: "entry_direction_gate",
    label: "Entry follows M1 setup side",
    passed: directionOk,
    points: directionOk && entry.decision !== "WAIT" ? 5 : 0,
    detail: `entry=${entry.decision} quality=${entry.entryQuality} trend=${trend.direction}`,
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
  nearLevel?: boolean;
  entryDistance?: number | null;
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

  if (input.entry.consistencyFail) {
    failed.push("BRAIN_CONSISTENCY_FAIL");
  } else {
    passed.push("Brain consistency OK.");
  }

  if (input.entry.decision === "BUY" || input.entry.decision === "SELL") {
    if (input.entry.entryQuality === "WEAK") {
      failed.push("ENTRY_QUALITY=WEAK — must WAIT.");
    } else {
      passed.push(`ENTRY_QUALITY=${input.entry.entryQuality}`);
    }
    if (!input.pullback.detected) failed.push("Entry without pullback.");
    else passed.push("Pullback detected.");
    if (!input.rejection.detected) failed.push("Entry without rejection.");
    else passed.push("Rejection detected.");
    if (!input.momentum.alignedWithTrend) failed.push("Entry without momentum alignment.");
    else passed.push("Momentum aligned with entry side.");
    if (input.nearLevel === false) failed.push("Entry not near S/R working level.");
    else if (input.nearLevel) passed.push("Near working level.");
  }

  if (
    input.entry.decision === "BUY" &&
    !(
      input.rejection.side === "bullish" &&
      (input.trend.direction === "bullish" || input.trend.direction === "sideways")
    )
  ) {
    failed.push("BUY requires bullish M1 setup with bullish or RANGE M5.");
  }
  if (
    input.entry.decision === "SELL" &&
    !(
      input.rejection.side === "bearish" &&
      (input.trend.direction === "bearish" || input.trend.direction === "sideways")
    )
  ) {
    failed.push("SELL requires bearish M1 setup with bearish or RANGE M5.");
  }

  if (!input.risk.allowed) failed.push(...input.risk.reasons);
  else passed.push("Risk checks allowed.");

  if (input.trend.direction === "unknown") {
    if (input.entry.decision !== "WAIT") {
      failed.push("Unknown M5 must WAIT.");
    } else {
      passed.push("Unknown M5 → WAIT enforced.");
    }
  }
  if (input.trend.direction === "sideways" && input.entry.decision !== "WAIT") {
    passed.push("RANGE edge scalp allowed.");
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
  nearLevel?: boolean;
  entryDistance?: number | null;
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
