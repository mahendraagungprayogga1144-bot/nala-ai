import { discountPercentOf, formatDiscountPercent } from "./types";

export function fmtRp(n: number | null | undefined) {
  return "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
}

/** "35% · Rp69.999" untuk nota, Telegram, dan dashboard. */
export function fmtDiscount(discount: number, retailTotal: number) {
  const amt = Math.round(Number(discount) || 0);
  if (!(amt > 0)) return "";
  const pct = formatDiscountPercent(discountPercentOf(retailTotal, amt));
  return pct ? `${pct} · ${fmtRp(amt)}` : fmtRp(amt);
}

export function fmtDateId(ymd: string | null | undefined) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function fmtDateLongId(ymd: string | null | undefined) {
  if (!ymd) return "—";
  const dt = new Date(ymd.slice(0, 10) + "T00:00:00+07:00");
  if (Number.isNaN(dt.getTime())) return ymd;
  return dt.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fmtDateTimeWib(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const dt = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
