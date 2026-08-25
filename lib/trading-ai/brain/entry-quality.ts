/**
 * Entry quality from auditable features — never Claude.
 * WEAK → WAIT; MEDIUM/STRONG boleh entry jika hard gates PASS.
 * Counter-trend requires MEDIUM+ and strongRejection.
 */

import type { ConfidenceFeature } from "../types";

export type EntryQuality = "WEAK" | "MEDIUM" | "STRONG";

export function scoreEntryQuality(input: {
  features: ConfidenceFeature[];
  pullback: boolean;
  rejection: boolean;
  momentum: boolean;
  nearLevel: boolean;
  distanceOk: boolean;
  consistencyOk: boolean;
  /** Counter setups must clear MEDIUM floor. */
  requireMedium?: boolean;
  strongRejection?: boolean;
}): { quality: EntryQuality; score: number } {
  const score = Math.max(
    0,
    Math.min(
      100,
      input.features.reduce((s, f) => s + (f.passed ? f.points : 0), 0),
    ),
  );

  const chainOk = input.pullback && input.rejection && input.momentum;
  if (
    !chainOk ||
    !input.distanceOk ||
    !input.consistencyOk ||
    !input.nearLevel ||
    score < 55
  ) {
    return { quality: "WEAK", score };
  }

  if (input.requireMedium && input.strongRejection === false) {
    return { quality: "WEAK", score };
  }

  if (score >= 80) return { quality: "STRONG", score };
  if (score >= 55) return { quality: "MEDIUM", score };
  return { quality: "WEAK", score };
}
