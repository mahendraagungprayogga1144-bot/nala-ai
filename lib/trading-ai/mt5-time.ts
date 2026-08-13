/**
 * Format waktu agar sama dengan yang terlihat di chart MetaTrader 5.
 *
 * rates[].time / TimeCurrent() di MQL5 adalah detik epoch yang
 * TimeToString()-nya menampilkan komponen kalender tanpa konversi zona.
 * Di JavaScript itu sama dengan memakai getUTC* pada Date(sec * 1000).
 *
 * Jangan pakai toLocaleString() zona lokal PC — itu menggeser jam
 * relatif chart MT5 (sering beda 2–7 jam) dan membingungkan monitoring.
 */

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

/** Samakan dengan TimeToString(..., TIME_DATE|TIME_MINUTES) di MT5. */
export function formatMt5Time(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const d = new Date(Math.floor(sec) * 1000);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS_ID[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon}, ${hh}.${mm}`;
}

/** Samakan dengan TimeToString(..., TIME_DATE|TIME_SECONDS). */
export function formatMt5DateTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const d = new Date(Math.floor(sec) * 1000);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS_ID[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${day} ${mon} ${hh}:${mm}:${ss}`;
}

/**
 * Estimasi jam broker "sekarang" dari heartbeat terakhir.
 * brokerTimeSec = TimeCurrent() yang dikirim EA.
 * capturedAtMs = kapan server menerima (epoch ms sungguhan).
 */
export function estimateBrokerNowSec(
  brokerTimeSec: number | null | undefined,
  capturedAtMs: number | null | undefined,
  nowMs = Date.now(),
): number | null {
  if (brokerTimeSec == null || !Number.isFinite(brokerTimeSec)) return null;
  if (capturedAtMs == null || !Number.isFinite(capturedAtMs)) {
    return Math.floor(brokerTimeSec);
  }
  const elapsedSec = Math.max(0, (nowMs - capturedAtMs) / 1000);
  return Math.floor(brokerTimeSec + elapsedSec);
}

/** Offset broker vs GMT dalam jam, untuk label "GMT+3". */
export function formatGmtOffsetLabel(offsetSec: number | null | undefined): string {
  if (offsetSec == null || !Number.isFinite(offsetSec)) return "broker MT5";
  const hours = offsetSec / 3600;
  if (Number.isInteger(hours)) {
    const sign = hours >= 0 ? "+" : "";
    return `GMT${sign}${hours}`;
  }
  const sign = offsetSec >= 0 ? "+" : "-";
  const abs = Math.abs(offsetSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `GMT${sign}${h}:${String(m).padStart(2, "0")}`;
}
