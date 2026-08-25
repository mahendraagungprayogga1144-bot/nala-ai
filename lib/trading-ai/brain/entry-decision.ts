/**
 * Entry Decision — human scalp chain:
 * M5 bias → M1 pullback → rejection near S/R → momentum → distance/quality/SL width.
 */

import type { TradingAiConfig } from "../config";
import type {
  EntryQuality,
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SupportResistanceAnalysis,
  TrendAnalysis,
} from "../types";
import { scoreEntryQuality } from "./entry-quality";
import { dynamicTakeProfitDistance } from "./dynamic-tp";

/** Max SL distance for XAU scalp (~25–30 points / ~2.5–3.0 price). */
const MAX_SCALP_SL = 3.0;
/** Max entry distance from working level before chase WAIT. */
const MAX_ENTRY_DISTANCE = 1.2;

function buildLong(input: {
  marketPrice: number;
  rejection: RejectionAnalysis;
  pullback: PullbackAnalysis;
  supportResistance: SupportResistanceAnalysis;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  config: TradingAiConfig;
  reason: string;
  entryDistance: number | null;
  entryQuality: EntryQuality;
}): EntrySignal {
  const { marketPrice, rejection, pullback, supportResistance, trend, momentum, config, reason } =
    input;
  const rawSl = rejection.atPrice ?? pullback.nearLevel ?? supportResistance.nearestSupport;
  const sl =
    rawSl != null ? Math.min(rawSl, marketPrice - Math.max(marketPrice * 0.0003, 0.05)) : null;
  const risk = sl != null ? Math.max(marketPrice - sl, marketPrice * 0.0005) : marketPrice * 0.0005;
  const roomToR =
    supportResistance.nearestResistance != null
      ? Math.max(0, supportResistance.nearestResistance - marketPrice)
      : null;
  const tpDist = dynamicTakeProfitDistance({
    marketPrice,
    riskDistance: risk,
    m5Strength: trend.strength,
    momentumStrength: momentum.strength,
    baseRr: config.brain.takeProfitRr,
    roomToStructure: roomToR,
  });
  return {
    decision: "BUY",
    reason,
    suggestedStopLoss: sl,
    suggestedTakeProfit: marketPrice + tpDist,
    suggestedLot: config.risk.defaultLot,
    entryDistance: input.entryDistance,
    entryQuality: input.entryQuality,
    consistencyFail: false,
  };
}

function buildShort(input: {
  marketPrice: number;
  rejection: RejectionAnalysis;
  pullback: PullbackAnalysis;
  supportResistance: SupportResistanceAnalysis;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  config: TradingAiConfig;
  reason: string;
  entryDistance: number | null;
  entryQuality: EntryQuality;
}): EntrySignal {
  const { marketPrice, rejection, pullback, supportResistance, trend, momentum, config, reason } =
    input;
  const rawSl = rejection.atPrice ?? pullback.nearLevel ?? supportResistance.nearestResistance;
  const sl =
    rawSl != null ? Math.max(rawSl, marketPrice + Math.max(marketPrice * 0.0003, 0.05)) : null;
  const risk = sl != null ? Math.max(sl - marketPrice, marketPrice * 0.0005) : marketPrice * 0.0005;
  const roomToS =
    supportResistance.nearestSupport != null
      ? Math.max(0, marketPrice - supportResistance.nearestSupport)
      : null;
  const tpDist = dynamicTakeProfitDistance({
    marketPrice,
    riskDistance: risk,
    m5Strength: trend.strength,
    momentumStrength: momentum.strength,
    baseRr: config.brain.takeProfitRr,
    roomToStructure: roomToS,
  });
  return {
    decision: "SELL",
    reason,
    suggestedStopLoss: sl,
    suggestedTakeProfit: marketPrice - tpDist,
    suggestedLot: config.risk.defaultLot,
    entryDistance: input.entryDistance,
    entryQuality: input.entryQuality,
    consistencyFail: false,
  };
}

const WAIT = (
  reason: string,
  extra?: Partial<Pick<EntrySignal, "entryDistance" | "entryQuality" | "consistencyFail">>,
): EntrySignal => ({
  decision: "WAIT",
  reason,
  suggestedStopLoss: null,
  suggestedTakeProfit: null,
  suggestedLot: null,
  entryDistance: extra?.entryDistance ?? null,
  entryQuality: extra?.entryQuality ?? "WEAK",
  consistencyFail: extra?.consistencyFail ?? false,
});

export function decideEntry(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  supportResistance: SupportResistanceAnalysis;
  marketPrice: number;
  config: TradingAiConfig;
  entryDistance?: number | null;
  nearLevel?: boolean;
}): EntrySignal {
  const {
    trend,
    pullback,
    rejection,
    momentum,
    supportResistance,
    marketPrice,
    config,
    entryDistance = null,
    nearLevel = false,
  } = input;

  if (trend.direction === "unknown" || trend.regime === "UNCLEAR") {
    return WAIT("Q1 M5 UNCLEAR — no entry.", { entryDistance });
  }

  // Consistency: trending bullish must not SELL (unless RANGE — already not bullish).
  if (
    trend.direction === "bullish" &&
    rejection.detected &&
    rejection.side === "bearish" &&
    momentum.direction === "bearish"
  ) {
    return WAIT("BRAIN_CONSISTENCY_FAIL — M5 BULLISH but SELL setup without RANGE. WAIT.", {
      entryDistance,
      consistencyFail: true,
      entryQuality: "WEAK",
    });
  }
  if (
    trend.direction === "bearish" &&
    rejection.detected &&
    rejection.side === "bullish" &&
    momentum.direction === "bullish"
  ) {
    return WAIT("BRAIN_CONSISTENCY_FAIL — M5 BEARISH but BUY setup without RANGE. WAIT.", {
      entryDistance,
      consistencyFail: true,
      entryQuality: "WEAK",
    });
  }

  if (!pullback.detected || !rejection.detected || !momentum.alignedWithTrend) {
    const parts = [
      `Q1 M5=${trend.regime}`,
      `Q3 PULLBACK=${pullback.detected ? "YES" : "NO"}`,
      `Q4 REJECTION=${rejection.detected ? "YES" : "NO"}`,
      `Q5 MOMENTUM=${momentum.alignedWithTrend ? "YES" : "NO"}`,
    ];
    const tip =
      pullback.notes[0] ||
      rejection.notes[0] ||
      momentum.notes[0] ||
      "Waiting for local swing setup.";
    return WAIT(`${parts.join(" | ")} — WAIT. ${tip}`, { entryDistance, entryQuality: "WEAK" });
  }

  if (
    trend.direction === "bullish" &&
    !(rejection.side === "bullish" && momentum.direction === "bullish")
  ) {
    return WAIT("M5 TRENDING_BULLISH — BUY bias only. M1 still not bullish.", {
      entryDistance,
      consistencyFail: true,
    });
  }
  if (
    trend.direction === "bearish" &&
    !(rejection.side === "bearish" && momentum.direction === "bearish")
  ) {
    return WAIT("M5 TRENDING_BEARISH — SELL bias only. M1 still not bearish.", {
      entryDistance,
      consistencyFail: true,
    });
  }

  const distanceOk =
    entryDistance == null || entryDistance <= MAX_ENTRY_DISTANCE;
  if (!distanceOk) {
    return WAIT(
      `Q6 ENTRY_DISTANCE=${entryDistance?.toFixed(2)} terlalu jauh (>${MAX_ENTRY_DISTANCE}). No chase — WAIT.`,
      { entryDistance, entryQuality: "WEAK" },
    );
  }

  if (!nearLevel) {
    return WAIT("Q6 Near S/R / working level = NO — jangan entry di tengah. WAIT.", {
      entryDistance,
      entryQuality: "WEAK",
    });
  }

  const qualityProbe = scoreEntryQuality({
    features: [
      {
        id: "m5",
        label: "m5",
        passed: true,
        points: Math.round(trend.strength * 30),
        detail: "",
      },
      {
        id: "pb",
        label: "pb",
        passed: pullback.detected,
        points: 20,
        detail: "",
      },
      {
        id: "rj",
        label: "rj",
        passed: rejection.detected,
        points: 25,
        detail: "",
      },
      {
        id: "mom",
        label: "mom",
        passed: momentum.alignedWithTrend,
        points: 15 + Math.round(momentum.strength * 10),
        detail: "",
      },
      {
        id: "lvl",
        label: "lvl",
        passed: nearLevel,
        points: 10,
        detail: "",
      },
    ],
    pullback: pullback.detected,
    rejection: rejection.detected,
    momentum: momentum.alignedWithTrend,
    nearLevel,
    distanceOk,
    consistencyOk: true,
  });

  if (qualityProbe.quality === "WEAK") {
    return WAIT(
      `ENTRY_QUALITY=WEAK (score=${qualityProbe.score}) — WAIT. Butuh MEDIUM/STRONG.`,
      { entryDistance, entryQuality: "WEAK" },
    );
  }

  const common = {
    marketPrice,
    rejection,
    pullback,
    supportResistance,
    trend,
    momentum,
    config,
    entryDistance,
    entryQuality: qualityProbe.quality,
  };

  if (rejection.side === "bullish" && momentum.direction === "bullish") {
    const draft = buildLong({
      ...common,
      reason: `BUY: ${trend.regime}, pullback+rejection di support/dasar, M1 momentum bullish. quality=${qualityProbe.quality} dist=${entryDistance?.toFixed(2) ?? "n/a"}`,
    });
    if (draft.suggestedStopLoss != null) {
      const slWidth = Math.abs(marketPrice - draft.suggestedStopLoss);
      if (slWidth > MAX_SCALP_SL) {
        return WAIT(
          `SL terlalu lebar untuk scalp (${slWidth.toFixed(2)} > ${MAX_SCALP_SL}). Setup buruk — WAIT.`,
          { entryDistance, entryQuality: "WEAK" },
        );
      }
    }
    return draft;
  }

  if (rejection.side === "bearish" && momentum.direction === "bearish") {
    const draft = buildShort({
      ...common,
      reason: `SELL: ${trend.regime}, pullback+rejection di resistance/pucuk, M1 momentum bearish. quality=${qualityProbe.quality} dist=${entryDistance?.toFixed(2) ?? "n/a"}`,
    });
    if (draft.suggestedStopLoss != null) {
      const slWidth = Math.abs(draft.suggestedStopLoss - marketPrice);
      if (slWidth > MAX_SCALP_SL) {
        return WAIT(
          `SL terlalu lebar untuk scalp (${slWidth.toFixed(2)} > ${MAX_SCALP_SL}). Setup buruk — WAIT.`,
          { entryDistance, entryQuality: "WEAK" },
        );
      }
    }
    return draft;
  }

  return WAIT("M1 setup side mismatch — WAIT.", { entryDistance });
}
