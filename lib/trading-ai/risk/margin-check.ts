/**
 * Margin gate — DEMO dan REAL sama.
 * Skip (allow) kalau EA belum kirim free margin (feed lama).
 */

import type { RiskCheck } from "../types";

export type MarginCheckInput = {
  freeMargin: number | null;
  /** Margin yang dibutuhkan untuk entry berikutnya (dari OrderCalcMargin EA). */
  requiredMargin: number | null;
  lot: number;
};

export function checkMargin(input: MarginCheckInput): RiskCheck {
  const { freeMargin, requiredMargin, lot } = input;

  if (freeMargin == null) {
    return { allowed: true, reasons: [] };
  }

  if (!(freeMargin > 0)) {
    return {
      allowed: false,
      reasons: ["Margin insufficient — free margin <= 0."],
    };
  }

  if (requiredMargin != null && requiredMargin > 0 && freeMargin < requiredMargin) {
    return {
      allowed: false,
      reasons: [
        `Margin insufficient — free ${freeMargin.toFixed(2)} < required ${requiredMargin.toFixed(2)} (lot ${lot}).`,
      ],
    };
  }

  return { allowed: true, reasons: [] };
}
