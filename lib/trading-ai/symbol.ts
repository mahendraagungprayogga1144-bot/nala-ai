import type { SymbolCode } from "./types";

/**
 * Broker sering pakai XAUUSDm / XAUUSD.s / GOLD — otak Gercep selalu XAUUSD.
 * Symbol selain gold DITOLAK (bukan di-map diam-diam).
 */

export function isAllowedGoldSymbol(raw: string | null | undefined): boolean {
  const u = (raw ?? "").trim().toUpperCase();
  if (!u) return false;
  return u.startsWith("XAU") || u.includes("GOLD");
}

/**
 * Resolve symbol untuk Brain. Non-gold → null (caller harus block).
 */
export function resolveTradingSymbol(
  raw: string | null | undefined,
): { ok: true; symbol: SymbolCode } | { ok: false; reason: string } {
  const u = (raw ?? "").trim().toUpperCase();
  if (!u) {
    return { ok: false, reason: "Symbol kosong — hanya XAUUSD diizinkan." };
  }
  if (!isAllowedGoldSymbol(u)) {
    return {
      ok: false,
      reason: `Wrong symbol "${u}" — hanya XAUUSD / XAUUSDm / GOLD diizinkan.`,
    };
  }
  return { ok: true, symbol: "XAUUSD" };
}

/**
 * Normalize gold aliases → XAUUSD.
 * Wrong symbol tetap di-return sebagai XAUUSD untuk back-compat caller lama;
 * API signal wajib memakai resolveTradingSymbol agar wrong symbol diblokir.
 */
export function normalizeTradingSymbol(raw: string | null | undefined): SymbolCode {
  const resolved = resolveTradingSymbol(raw);
  return resolved.ok ? resolved.symbol : "XAUUSD";
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
