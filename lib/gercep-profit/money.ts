/** Deterministic money helpers. IDR is stored as whole rupiah. */

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function roundRatio(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const r = numerator / denominator;
  if (!Number.isFinite(r)) return null;
  return r;
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function inEffectiveWindow(
  asOf: string,
  from: string,
  until?: string | null,
): boolean {
  if (from && asOf < from) return false;
  if (until && asOf > until) return false;
  return true;
}
