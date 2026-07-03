/** Tanggal hari ini zona WIB (Asia/Jakarta), format YYYY-MM-DD */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}
