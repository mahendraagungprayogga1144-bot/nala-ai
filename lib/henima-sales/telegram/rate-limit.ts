const buckets = new Map<string, { n: number; reset: number }>();

export function telegramRateOk(telegramUserId: number, max = 40, windowMs = 60_000) {
  const key = String(telegramUserId);
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now > cur.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}
