/**
 * Entry Decision Engine — M5 bias + M1 shallow pullback scalp ("perampok").
 * Bullish M5 → BUY only on red dip after green pressure;
 * bearish M5 → SELL only on green rally after red pressure;
 * sideways → sama, dua arah; unknown → WAIT.
 * Tidak wajib S/R; edge filter cegah BUY di pucuk / SELL di dasar kotak.
 */

import type { TradingAiConfig } from "../config";
import type {
  EntrySignal,
  MomentumAnalysis,
  PullbackAnalysis,
  RejectionAnalysis,
  SupportResistanceAnalysis,
  TrendAnalysis,
} from "../types";
import { dynamicTakeProfitDistance } from "./dynamic-tp";

function buildLong(input: {
  marketPrice: number;
  rejection: RejectionAnalysis;
  pullback: PullbackAnalysis;
  supportResistance: SupportResistanceAnalysis;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  config: TradingAiConfig;
  reason: string;
}): EntrySignal {
  const { marketPrice, rejection, pullback, supportResistance, trend, momentum, config, reason } =
    input;
  const rawSl = rejection.atPrice ?? pullback.nearLevel ?? supportResistance.nearestSupport;
  const sl =
    rawSl != null ? Math.min(rawSl, marketPrice - Math.max(marketPrice * 0.0003, 0.05)) : null;
  const risk = sl != null ? Math.max(marketPrice - sl, marketPrice * 0.0005) : marketPrice * 0.0005;
  const tpDist = dynamicTakeProfitDistance({
    marketPrice,
    riskDistance: risk,
    m5Strength: trend.strength,
    momentumStrength: momentum.strength,
    baseRr: config.brain.takeProfitRr,
  });
  return {
    decision: "BUY",
    reason,
    suggestedStopLoss: sl,
    suggestedTakeProfit: marketPrice + tpDist,
    suggestedLot: config.risk.defaultLot,
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
}): EntrySignal {
  const { marketPrice, rejection, pullback, supportResistance, trend, momentum, config, reason } =
    input;
  const rawSl = rejection.atPrice ?? pullback.nearLevel ?? supportResistance.nearestResistance;
  const sl =
    rawSl != null ? Math.max(rawSl, marketPrice + Math.max(marketPrice * 0.0003, 0.05)) : null;
  const risk = sl != null ? Math.max(sl - marketPrice, marketPrice * 0.0005) : marketPrice * 0.0005;
  const tpDist = dynamicTakeProfitDistance({
    marketPrice,
    riskDistance: risk,
    m5Strength: trend.strength,
    momentumStrength: momentum.strength,
    baseRr: config.brain.takeProfitRr,
  });
  return {
    decision: "SELL",
    reason,
    suggestedStopLoss: sl,
    suggestedTakeProfit: marketPrice - tpDist,
    suggestedLot: config.risk.defaultLot,
  };
}

const WAIT = (reason: string): EntrySignal => ({
  decision: "WAIT",
  reason,
  suggestedStopLoss: null,
  suggestedTakeProfit: null,
  suggestedLot: null,
});

/**
 * Di kotak S/R: BUY hanya di setengah bawah (dekat support),
 * SELL hanya di setengah atas (dekat resistance).
 * Cegah entry di "pucuk" / "dasar" lawan arah scalp.
 */
function rangeEdgeAllows(
  side: "BUY" | "SELL",
  marketPrice: number,
  support: number | null,
  resistance: number | null,
): { ok: boolean; reason: string } {
  if (support == null || resistance == null || !(resistance > support)) {
    return { ok: true, reason: "" };
  }
  const mid = (support + resistance) / 2;
  const box = resistance - support;
  // Long: harga harus di bawah mid (lebih dekat support). Tolak kalau sudah di zona atas.
  if (side === "BUY") {
    const nearTop = marketPrice >= mid + box * 0.05;
    if (nearTop) {
      return {
        ok: false,
        reason: `Range box: harga ${marketPrice.toFixed(2)} dekat resistance — jangan BUY di pucuk.`,
      };
    }
    return { ok: true, reason: "" };
  }
  // Short: harga harus di atas mid. Tolak kalau sudah di zona bawah.
  const nearBottom = marketPrice <= mid - box * 0.05;
  if (nearBottom) {
    return {
      ok: false,
      reason: `Range box: harga ${marketPrice.toFixed(2)} dekat support — jangan SELL di dasar.`,
    };
  }
  return { ok: true, reason: "" };
}

export function decideEntry(input: {
  trend: TrendAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  supportResistance: SupportResistanceAnalysis;
  marketPrice: number;
  config: TradingAiConfig;
}): EntrySignal {
  const { trend, pullback, rejection, momentum, supportResistance, marketPrice, config } = input;

  if (trend.direction === "unknown") {
    return WAIT("M5 bias unknown — no entry.");
  }

  if (!pullback.detected) {
    return WAIT(
      trend.direction === "sideways"
        ? "Sideways: waiting for shallow M1 pullback."
        : "Waiting for shallow M1 pullback against pressure.",
    );
  }

  if (!rejection.detected) {
    return WAIT("Pullback seen — waiting for entry candle on the dip/rally.");
  }

  if (!momentum.alignedWithTrend) {
    return WAIT("Need prior M1 pressure with bias before entry.");
  }

  // --- M5 sideways: arah dari pullback M1 (dua arah) ---
  if (trend.direction === "sideways") {
    if (rejection.side === "bullish" && momentum.direction === "bullish") {
      const edge = rangeEdgeAllows(
        "BUY",
        marketPrice,
        supportResistance.nearestSupport,
        supportResistance.nearestResistance,
      );
      if (!edge.ok) return WAIT(edge.reason);
      return buildLong({
        marketPrice,
        rejection,
        pullback,
        supportResistance,
        trend,
        momentum,
        config,
        reason: "M5 sideways — BUY on shallow red pullback after green pressure.",
      });
    }
    if (rejection.side === "bearish" && momentum.direction === "bearish") {
      const edge = rangeEdgeAllows(
        "SELL",
        marketPrice,
        supportResistance.nearestSupport,
        supportResistance.nearestResistance,
      );
      if (!edge.ok) return WAIT(edge.reason);
      return buildShort({
        marketPrice,
        rejection,
        pullback,
        supportResistance,
        trend,
        momentum,
        config,
        reason: "M5 sideways — SELL on shallow green pullback after red pressure.",
      });
    }
    return WAIT("Sideways: pullback side mismatch — WAIT.");
  }

  if (trend.direction === "bullish") {
    if (rejection.side === "bearish") {
      return WAIT("M5 bullish — ignore sell-side pullback (BUY only).");
    }
    return buildLong({
      marketPrice,
      rejection,
      pullback,
      supportResistance,
      trend,
      momentum,
      config,
      reason: "M5 bullish — BUY on shallow red pullback after M1 green pressure.",
    });
  }

  if (trend.direction === "bearish") {
    if (rejection.side === "bullish") {
      return WAIT("M5 bearish — ignore buy-side pullback (SELL only).");
    }
    return buildShort({
      marketPrice,
      rejection,
      pullback,
      supportResistance,
      trend,
      momentum,
      config,
      reason: "M5 bearish — SELL on shallow green pullback after M1 red pressure.",
    });
  }

  return WAIT("Setup incomplete.");
}
