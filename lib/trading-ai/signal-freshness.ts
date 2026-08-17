/**
 * Signal freshness — stale signals must not be executed.
 */

/** Max age of a signal before EA/server marks it non-executable. */
export const SIGNAL_FRESHNESS_MS = 20_000;

export function isSignalFresh(generatedAt: number | null | undefined, now = Date.now()): boolean {
  if (generatedAt == null || !Number.isFinite(generatedAt)) return false;
  const age = now - generatedAt;
  if (!Number.isFinite(age) || age < 0) return false;
  return age <= SIGNAL_FRESHNESS_MS;
}

export function signalAgeMs(generatedAt: number | null | undefined, now = Date.now()): number | null {
  if (generatedAt == null || !Number.isFinite(generatedAt)) return null;
  const age = now - generatedAt;
  return Number.isFinite(age) ? age : null;
}
