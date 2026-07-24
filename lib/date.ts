/** Tanggal hari ini zona WIB (Asia/Jakarta), format YYYY-MM-DD */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/** Last calendar day of month as YYYY-MM-DD (local, no UTC shift via toISOString). */
export function monthEndYmd(year: number, month1to12: number): string {
  const lastDay = new Date(year, month1to12, 0).getDate();
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** First calendar day of month as YYYY-MM-DD. */
export function monthStartYmd(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}-01`;
}
