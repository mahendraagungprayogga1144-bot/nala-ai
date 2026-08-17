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
