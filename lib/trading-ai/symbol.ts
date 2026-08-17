import type { SymbolCode } from "./types";

/**
 * Broker sering pakai XAUUSDm / XAUUSD.s / GOLD — otak Gercep selalu XAUUSD.
 */
export function normalizeTradingSymbol(raw: string | null | undefined): SymbolCode {
  const u = (raw ?? "").trim().toUpperCase();
  if (!u) return "XAUUSD";
  if (u.startsWith("XAU") || u.includes("GOLD")) return "XAUUSD";
  return "XAUUSD";
}

/**
 * Spread ke skala otak Gercep: 1 point ≈ 0.01 harga XAU.
 * Exness XAUUSDm (digits=3) sering kirim (ask-bid)/point ≈ 260; yang benar ≈ 26.
 * Lebih aman hitung ulang dari bid/ask kalau ada.
 */
export function normalizeGoldSpreadPoints(input: {
  spread: number | null;
  bid: number | null;
  ask: number | null;
}): number {
  const { bid, ask, spread } = input;
  if (bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask) && ask > bid) {
    return Math.max(0, Math.round((ask - bid) * 100));
  }
  let s = spread != null && Number.isFinite(spread) ? spread : 0;
  if (s > 120) s = Math.round(s / 10);
  return Math.max(0, Math.round(s));
}
