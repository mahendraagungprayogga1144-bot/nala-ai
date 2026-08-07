/**
 * Shared price-action helpers (swings, ranges) — no indicators as primary.
 */

import type { Candle } from "../types";

export type SwingPoint = {
  index: number;
  price: number;
  time: number;
  kind: "high" | "low";
};

/** Local swing high/low with `left`/`right` bars confirmation. */
export function findSwings(
  candles: Candle[],
  left = 2,
  right = 2,
): SwingPoint[] {
  const out: SwingPoint[] = [];
  if (candles.length < left + right + 1) return out;

  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high > c.high) isHigh = false;
      if (candles[j].low < c.low) isLow = false;
    }
    // Prefer exclusive pivot; skip bar that is both (rare flat noise).
    if (isHigh && !isLow) {
      out.push({ index: i, price: c.high, time: c.time, kind: "high" });
    } else if (isLow && !isHigh) {
      out.push({ index: i, price: c.low, time: c.time, kind: "low" });
    }
  }
  return out;
}

export function lastSwings(swings: SwingPoint[], kind: "high" | "low", n: number): SwingPoint[] {
  return swings.filter((s) => s.kind === kind).slice(-n);
}

export function bodySize(c: Candle) {
  return Math.abs(c.close - c.open);
}

export function upperWick(c: Candle) {
  return Math.max(0, c.high - Math.max(c.open, c.close));
}

export function lowerWick(c: Candle) {
  return Math.max(0, Math.min(c.open, c.close) - c.low);
}

export function isBullishCandle(c: Candle) {
  return c.close > c.open;
}

export function isBearishCandle(c: Candle) {
  return c.close < c.open;
}

export function rangeMid(c: Candle) {
  return (c.high + c.low) / 2;
}

/** Average true range — sizing / tolerance only, not a signal. */
export function atrApprox(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const n = Math.min(period, candles.length - 1);
  let sum = 0;
  for (let i = candles.length - n; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1] ?? c;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
    sum += tr;
  }
  return sum / n;
}

export function nearLevel(price: number, level: number, tolerance: number) {
  return Math.abs(price - level) <= tolerance;
}

export function clusterLevels(
  prices: number[],
  tolerance: number,
): { price: number; touches: number }[] {
  if (!prices.length) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: { price: number; touches: number; sum: number }[] = [];

  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p - last.price) <= tolerance) {
      last.sum += p;
      last.touches += 1;
      last.price = last.sum / last.touches;
    } else {
      clusters.push({ price: p, touches: 1, sum: p });
    }
  }

  return clusters.map(({ price, touches }) => ({ price, touches }));
}

/** Prefer last fully closed bar when a forming bar may be incomplete. */
export function lastClosedIndex(candles: Candle[]) {
  return candles.length >= 2 ? candles.length - 2 : candles.length - 1;
}
