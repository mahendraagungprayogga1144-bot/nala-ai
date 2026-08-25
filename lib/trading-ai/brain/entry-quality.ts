/**
 * Entry quality from auditable features — never Claude.
 * WEAK → WAIT; MEDIUM/STRONG boleh entry jika hard gates PASS.
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
  if (score >= 80) return { quality: "STRONG", score };
  return { quality: "MEDIUM", score };
}
