/** Trial gratis untuk akun baru — seperti startup SaaS. */
export const TRIAL_DAYS = 5;

export function trialEndsAt(from = new Date(), days = TRIAL_DAYS) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function trialPayload(userId: string, from = new Date(), days = TRIAL_DAYS) {
  const ends = trialEndsAt(from, days).toISOString();
  return {
    user_id: userId,
    plan: "trial",
    status: "trial",
    started_at: from.toISOString(),
    expired_at: ends,
    trial_ends_at: ends,
    updated_at: new Date().toISOString(),
  };
}

function wibYmd(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
}

/** Trial tetap hidup sampai akhir hari WIB tanggal berakhirnya, bukan di jam pendaftaran. */
export function trialOpenUntil(iso: string) {
  const ymd = wibYmd(new Date(iso));
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

export function trialStillOpen(iso: string | null | undefined, now = new Date()) {
  if (!iso) return false;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return false;
  return now.getTime() <= trialOpenUntil(iso).getTime();
}

export function daysLeft(iso: string | null | undefined, now = new Date()) {
  if (!iso || !trialStillOpen(iso, now)) return null;
  const [ay, am, ad] = wibYmd(now).split("-").map(Number);
  const [by, bm, bd] = wibYmd(new Date(iso)).split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000));
}
