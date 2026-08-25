/**
 * Entry Decision — Hybrid S/R + M5 bias:
 * M5 context + zone setupKind → M1 chain → distance/quality/SL width.
 * Counter-trend only when setupKind=COUNTER with strongRejection + quality≥MEDIUM.
 */

import type { TradingAiConfig } from "../config";
import type {
  EntryQuality,
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SetupKind,
  SupportResistanceAnalysis,
  TrendAnalysis,
} from "../types";
import { scoreEntryQuality } from "./entry-quality";
import { dynamicTakeProfitDistance } from "./dynamic-tp";

/** Max SL distance for XAU scalp (~25–30 points / ~2.5–3.0 price). */
const MAX_SCALP_SL = 3.0;
/** Max entry distance from working level before chase WAIT. */
const MAX_ENTRY_DISTANCE = 0.85;

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
  setupKind: SetupKind;
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
    setupKind: input.setupKind,
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
  setupKind: SetupKind;
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
    setupKind: input.setupKind,
  };
}

const WAIT = (
  reason: string,
  extra?: Partial<
    Pick<EntrySignal, "entryDistance" | "entryQuality" | "consistencyFail" | "setupKind">
  >,
): EntrySignal => ({
  decision: "WAIT",
  reason,
  suggestedStopLoss: null,
  suggestedTakeProfit: null,
  suggestedLot: null,
  entryDistance: extra?.entryDistance ?? null,
  entryQuality: extra?.entryQuality ?? "WEAK",
  consistencyFail: extra?.consistencyFail ?? false,
  setupKind: extra?.setupKind ?? "NONE",
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
  setupKind?: SetupKind;
  strongRejection?: boolean;
  breakoutContinuation?: boolean;
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
    setupKind = "NONE",
    strongRejection = false,
    breakoutContinuation = false,
  } = input;

  if (trend.direction === "unknown" || trend.regime === "UNCLEAR") {
    return WAIT("Q1 M5 UNCLEAR — no entry.", { entryDistance, setupKind });
  }

  if (breakoutContinuation) {
    return WAIT("Breakout/breakdown continuation — jangan fade. WAIT.", {
      entryDistance,
      setupKind,
      entryQuality: "WEAK",
    });
  }

  const wantsSell =
    rejection.detected && rejection.side === "bearish" && momentum.direction === "bearish";
  const wantsBuy =
    rejection.detected && rejection.side === "bullish" && momentum.direction === "bullish";

  // Consistency: counter only when setupKind allows it.
  if (trend.direction === "bullish" && wantsSell) {
    const counterOk = setupKind === "COUNTER" || setupKind === "RANGE";
    if (!counterOk || (setupKind === "COUNTER" && !strongRejection)) {
      return WAIT(
        "BRAIN_CONSISTENCY_FAIL — M5 BULLISH + SELL tanpa valid resistance counter. WAIT.",
        {
          entryDistance,
          consistencyFail: true,
          entryQuality: "WEAK",
          setupKind,
        },
      );
    }
  }
  if (trend.direction === "bearish" && wantsBuy) {
    const counterOk = setupKind === "COUNTER" || setupKind === "RANGE";
    if (!counterOk || (setupKind === "COUNTER" && !strongRejection)) {
      return WAIT(
        "BRAIN_CONSISTENCY_FAIL — M5 BEARISH + BUY tanpa valid support counter. WAIT.",
        {
          entryDistance,
          consistencyFail: true,
          entryQuality: "WEAK",
          setupKind,
        },
      );
    }
  }

  // With-trend side mismatch.
  if (
    setupKind === "WITH_TREND" &&
    trend.direction === "bullish" &&
    wantsSell
  ) {
    return WAIT("BRAIN_CONSISTENCY_FAIL — WITH_TREND bullish tidak boleh SELL.", {
      entryDistance,
      consistencyFail: true,
      setupKind,
    });
  }
  if (
    setupKind === "WITH_TREND" &&
    trend.direction === "bearish" &&
    wantsBuy
  ) {
    return WAIT("BRAIN_CONSISTENCY_FAIL — WITH_TREND bearish tidak boleh BUY.", {
      entryDistance,
      consistencyFail: true,
      setupKind,
    });
  }

  if (!pullback.detected || !rejection.detected || !momentum.alignedWithTrend) {
    const parts = [
      `Q1 M5=${trend.regime}`,
      `Q3 PULLBACK=${pullback.detected ? "YES" : "NO"}`,
      `Q4 REJECTION=${rejection.detected ? "YES" : "NO"}`,
      `Q5 MOMENTUM=${momentum.alignedWithTrend ? "YES" : "NO"}`,
      `kind=${setupKind}`,
    ];
    const tip =
      pullback.notes[0] ||
      rejection.notes[0] ||
      momentum.notes[0] ||
      "Waiting for local swing setup.";
    return WAIT(`${parts.join(" | ")} — WAIT. ${tip}`, {
      entryDistance,
      entryQuality: "WEAK",
      setupKind,
    });
  }

  const distanceOk = entryDistance == null || entryDistance <= MAX_ENTRY_DISTANCE;
  if (!distanceOk) {
    return WAIT(
      `Q6 ENTRY_DISTANCE=${entryDistance?.toFixed(2)} terlalu jauh (>${MAX_ENTRY_DISTANCE}). No chase — WAIT.`,
      { entryDistance, entryQuality: "WEAK", setupKind },
    );
  }

  if (!nearLevel) {
    return WAIT("Q6 Near S/R = NO — jangan entry di tengah. WAIT.", {
      entryDistance,
      entryQuality: "WEAK",
      setupKind,
    });
  }

  const isCounter = setupKind === "COUNTER";
  const withTrend =
    (trend.direction === "bullish" && wantsBuy) ||
    (trend.direction === "bearish" && wantsSell) ||
    setupKind === "RANGE";

  const qualityProbe = scoreEntryQuality({
    features: [
      {
        id: "m5",
        label: "m5",
        passed: true,
        points: Math.round(trend.strength * (isCounter ? 18 : 28)),
        detail: "",
      },
      {
        id: "pb",
        label: "pb",
        passed: pullback.detected,
        points: 18,
        detail: "",
      },
      {
        id: "rj",
        label: "rj",
        passed: rejection.detected,
        points: isCounter && strongRejection ? 28 : 22,
        detail: "",
      },
      {
        id: "mom",
        label: "mom",
        passed: momentum.alignedWithTrend,
        points: 12 + Math.round(momentum.strength * 12),
        detail: "",
      },
      {
        id: "lvl",
        label: "lvl",
        passed: nearLevel,
        points: 12,
        detail: "",
      },
      {
        id: "align",
        label: "align",
        passed: withTrend || (isCounter && strongRejection),
        points: withTrend ? 8 : isCounter && strongRejection ? 6 : 0,
        detail: "",
      },
    ],
    pullback: pullback.detected,
    rejection: rejection.detected,
    momentum: momentum.alignedWithTrend,
    nearLevel,
    distanceOk,
    consistencyOk: true,
    requireMedium: isCounter,
    strongRejection: isCounter ? strongRejection : true,
  });

  if (qualityProbe.quality === "WEAK") {
    return WAIT(
      `ENTRY_QUALITY=WEAK (score=${qualityProbe.score}) — WAIT. Butuh MEDIUM/STRONG.`,
      { entryDistance, entryQuality: "WEAK", setupKind },
    );
  }

  if (isCounter && !strongRejection) {
    return WAIT("COUNTER requires strongRejection — WAIT.", {
      entryDistance,
      entryQuality: "WEAK",
      setupKind,
    });
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
    setupKind,
  };

  if (wantsBuy) {
    const draft = buildLong({
      ...common,
      reason: `BUY (${setupKind}): ${trend.regime}, near support, pullback+rejection+M1 bullish. quality=${qualityProbe.quality} dist=${entryDistance?.toFixed(2) ?? "n/a"}`,
    });
    if (draft.suggestedStopLoss != null) {
      const slWidth = Math.abs(marketPrice - draft.suggestedStopLoss);
      if (slWidth > MAX_SCALP_SL) {
        return WAIT(
          `SL terlalu lebar untuk scalp (${slWidth.toFixed(2)} > ${MAX_SCALP_SL}). WAIT.`,
          { entryDistance, entryQuality: "WEAK", setupKind },
        );
      }
    }
    return draft;
  }

  if (wantsSell) {
    const draft = buildShort({
      ...common,
      reason: `SELL (${setupKind}): ${trend.regime}, near resistance, pullback+rejection+M1 bearish. quality=${qualityProbe.quality} dist=${entryDistance?.toFixed(2) ?? "n/a"}`,
    });
    if (draft.suggestedStopLoss != null) {
      const slWidth = Math.abs(draft.suggestedStopLoss - marketPrice);
      if (slWidth > MAX_SCALP_SL) {
        return WAIT(
          `SL terlalu lebar untuk scalp (${slWidth.toFixed(2)} > ${MAX_SCALP_SL}). WAIT.`,
          { entryDistance, entryQuality: "WEAK", setupKind },
        );
      }
    }
    return draft;
  }

  return WAIT("M1 setup side mismatch — WAIT.", { entryDistance, setupKind });
}
