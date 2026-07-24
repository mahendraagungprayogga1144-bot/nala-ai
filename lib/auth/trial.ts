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

export function daysLeft(iso: string | null | undefined) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / 86400000);
}
