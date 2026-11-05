/** Jam tutup GPS otomatis (WIB). Setelah ini tracking berhenti. */
export const TRACKING_AUTO_CLOSE_HOUR = 18;

export function wibParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function wibHourNow(date = new Date()) {
  return wibParts(date).hour;
}

/** true kalau sudah lewat / tepat jam tutup GPS. */
export function isPastTrackingAutoClose(date = new Date()) {
  return wibHourNow(date) >= TRACKING_AUTO_CLOSE_HOUR;
}
