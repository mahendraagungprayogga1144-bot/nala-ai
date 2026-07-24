/** Trial gratis untuk akun baru & demo — seperti startup SaaS. */
export const TRIAL_DAYS = 5;

export function trialEndsAt(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

export function trialPayload(userId: string, from = new Date()) {
  const ends = trialEndsAt(from).toISOString();
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
