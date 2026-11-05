import { createHash } from "node:crypto";

export function automationIdempotencyKey(parts: string[]) {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 48);
}

/** Calendar day key in Asia/Jakarta. */
export function jakartaDayKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function jakartaWeekKey(d = new Date()) {
  // ISO-like week label using Monday start in WIB day string
  const day = jakartaDayKey(d);
  const [y, m, dd] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, dd));
  const dow = utc.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  utc.setUTCDate(utc.getUTCDate() + mondayOffset);
  return `w${utc.toISOString().slice(0, 10)}`;
}
