import type { DecisionStatus, Ratio } from "./types";

export function formatRp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  const abs = Math.abs(Math.round(n));
  const s = "Rp" + abs.toLocaleString("id-ID");
  return n < 0 ? `-${s}` : s;
}

export function formatRpShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}Rp${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}Rp${Math.round(abs).toLocaleString("id-ID")}`;
}

export function formatX(ratio: Ratio): string {
  if (ratio == null || !Number.isFinite(ratio)) return "N/A";
  return `${ratio.toFixed(2)}x`;
}

export function formatPct(ratio: Ratio, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return "N/A";
  return `${ratio.toFixed(digits)}%`;
}

export function formatFormula(left: string, right: string, result: string): string {
  return `${left} / ${right} = ${result}`;
}

export const STATUS_TONE: Record<
  DecisionStatus,
  { bg: string; border: string; text: string; dot: string }
> = {
  SCALE: {
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.35)",
    text: "#34D399",
    dot: "#10B981",
  },
  OPTIMIZE: {
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    text: "#FBBF24",
    dot: "#F59E0B",
  },
  STOP: {
    bg: "rgba(244,63,94,0.12)",
    border: "rgba(244,63,94,0.35)",
    text: "#FB7185",
    dot: "#F43F5E",
  },
  PRODUCT_NOT_PROFITABLE: {
    bg: "rgba(244,63,94,0.12)",
    border: "rgba(244,63,94,0.35)",
    text: "#FB7185",
    dot: "#F43F5E",
  },
};
