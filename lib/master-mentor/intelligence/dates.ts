import { addDaysYmd, periodRange as henimaPeriodRange, wibParts } from "@/lib/henima-sales/dates";
import { todayWib } from "@/lib/date";

export type IntelligencePeriod =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "custom";

export type DateWindow = {
  from: string;
  to: string;
  label: string;
  kind: IntelligencePeriod;
  days: number;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function dayCount(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Equal-length prior window ending the day before `from`. */
export function priorWindow(from: string, to: string): { from: string; to: string; days: number } {
  const days = dayCount(from, to);
  const priorTo = addDaysYmd(from, -1);
  const priorFrom = addDaysYmd(priorTo, -(days - 1));
  return { from: priorFrom, to: priorTo, days };
}

export function resolveIntelligencePeriod(
  kind: IntelligencePeriod,
  custom?: { from?: string; to?: string },
): DateWindow {
  const today = todayWib();

  if (kind === "last_7_days") {
    const from = addDaysYmd(today, -6);
    return { kind, from, to: today, label: "7 hari terakhir", days: 7 };
  }
  if (kind === "last_30_days") {
    const from = addDaysYmd(today, -29);
    return { kind, from, to: today, label: "30 hari terakhir", days: 30 };
  }
  if (kind === "custom") {
    const from = custom?.from || "";
    const to = custom?.to || "";
    if (!isYmd(from) || !isYmd(to)) {
      throw new Error("Custom date range memerlukan from/to berformat YYYY-MM-DD.");
    }
    if (from > to) throw new Error("Tanggal mulai tidak boleh setelah tanggal akhir.");
    return { kind, from, to, label: `${from}–${to}`, days: dayCount(from, to) };
  }

  const map: Record<Exclude<IntelligencePeriod, "last_7_days" | "last_30_days" | "custom">, Parameters<typeof henimaPeriodRange>[0]> = {
    today: "today",
    yesterday: "yesterday",
    this_month: "this_month",
    last_month: "last_month",
  };
  const mapped = map[kind];
  const range = henimaPeriodRange(mapped);
  return {
    kind,
    from: range.from,
    to: range.to,
    label: range.label,
    days: dayCount(range.from, range.to),
  };
}

export function parsePeriodParam(
  raw: string | null | undefined,
): IntelligencePeriod {
  const v = (raw || "last_30_days").trim().toLowerCase();
  const allowed: IntelligencePeriod[] = [
    "today",
    "yesterday",
    "last_7_days",
    "last_30_days",
    "this_month",
    "last_month",
    "custom",
  ];
  if ((allowed as string[]).includes(v)) return v as IntelligencePeriod;
  return "last_30_days";
}

export function monthKey(ymd: string) {
  return ymd.slice(0, 7);
}

export function wibTodayParts() {
  return wibParts();
}
