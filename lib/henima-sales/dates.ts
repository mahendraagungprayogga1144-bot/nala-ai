import { todayWib } from "@/lib/date";
import type { TargetPeriod } from "./types";

const WIB = "Asia/Jakarta";

export function wibParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { year: get("year"), month: get("month"), day: get("day"), weekday: get("weekday") };
}

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function startOfWeekMonday(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dow = dt.getUTCDay(); // 0 Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export function periodRange(
  kind: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom",
  custom?: { from?: string; to?: string },
): { from: string; to: string; label: string } {
  const today = todayWib();
  const { year, month } = wibParts();
  const y = Number(year);
  const mo = Number(month);

  if (kind === "today") return { from: today, to: today, label: "Hari ini" };
  if (kind === "yesterday") {
    const yest = addDaysYmd(today, -1);
    return { from: yest, to: yest, label: "Kemarin" };
  }
  if (kind === "this_week") {
    const from = startOfWeekMonday(today);
    return { from, to: today, label: `${fmtShort(from)}–${fmtShort(today)}` };
  }
  if (kind === "last_week") {
    const thisMon = startOfWeekMonday(today);
    const from = addDaysYmd(thisMon, -7);
    const to = addDaysYmd(thisMon, -1);
    return { from, to, label: `${fmtShort(from)}–${fmtShort(to)}` };
  }
  if (kind === "this_month") {
    const from = `${year}-${month}-01`;
    return { from, to: today, label: monthLabel(y, mo) };
  }
  if (kind === "last_month") {
    const lm = mo === 1 ? 12 : mo - 1;
    const ly = mo === 1 ? y - 1 : y;
    const from = `${ly}-${String(lm).padStart(2, "0")}-01`;
    const lastDay = new Date(ly, lm, 0).getDate();
    const to = `${ly}-${String(lm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to, label: monthLabel(ly, lm) };
  }
  const from = custom?.from || today;
  const to = custom?.to || today;
  const full = fullMonthLabel(from, to);
  return { from, to, label: full || `${fmtShort(from)}–${fmtShort(to)}` };
}

/** First–last day of a calendar month in Asia/Jakarta. month is 1–12. */
export function calendarMonthRange(year: number, month: number): { from: string; to: string; label: string } {
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, label: monthLabel(year, month) };
}

/** Named month without year → this year, or last year if that month is still in the future. */
export function namedMonthWindow(month: number, year?: number) {
  const { year: cy, month: cm } = wibParts();
  const y =
    year && year >= 2000 && year <= 2100 ? year : month > Number(cm) ? Number(cy) - 1 : Number(cy);
  return calendarMonthRange(y, month);
}

function fullMonthLabel(from: string, to: string) {
  const fm = from.match(/^(\d{4})-(\d{2})-01$/);
  const tm = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fm || !tm || fm[1] !== tm[1] || fm[2] !== tm[2]) return null;
  const lastDay = new Date(Number(fm[1]), Number(fm[2]), 0).getDate();
  if (Number(tm[3]) !== lastDay) return null;
  return monthLabel(Number(fm[1]), Number(fm[2]));
}

export function targetWindow(period: TargetPeriod, ymd = todayWib()) {
  if (period === "daily") return { from: ymd, to: ymd };
  if (period === "weekly") return { from: startOfWeekMonday(ymd), to: ymd };
  const { year, month } = wibParts(new Date(ymd + "T00:00:00+07:00"));
  return { from: `${year}-${month}-01`, to: ymd };
}

function fmtShort(ymd: string) {
  const [y, m, d] = ymd.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

function monthLabel(y: number, m: number) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${months[m - 1]} ${y}`;
}
