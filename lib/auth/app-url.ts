/** Canonical public app URL for auth redirects (password reset, email links). */
export function getAppOrigin(fallbackOrigin?: string) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return "https://www.gercepos.id";
}
