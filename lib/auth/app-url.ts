const DEFAULT_APP_ORIGIN = "https://www.gercepos.id";

function normalizeOrigin(raw: string) {
  let origin = raw.trim().replace(/\/$/, "");
  if (!origin) return DEFAULT_APP_ORIGIN;
  if (!/^https?:\/\//i.test(origin)) origin = `https://${origin}`;
  return origin.replace(/\/$/, "");
}

/** Canonical public app URL for auth redirects (password reset, email links). */
export function getAppOrigin(fallbackOrigin?: string) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return normalizeOrigin(fromEnv);
  if (fallbackOrigin) return normalizeOrigin(fallbackOrigin);
  return DEFAULT_APP_ORIGIN;
}

/**
 * Origin safe to put in WhatsApp / email share text.
 * Never emits localhost — WA cannot open those links for recipients.
 */
export function getPublicShareOrigin(fallbackOrigin?: string) {
  const origin = getAppOrigin(fallbackOrigin);
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return DEFAULT_APP_ORIGIN;
  }
  // Production domain must be HTTPS so WA accepts the tap target.
  if (/^http:\/\//i.test(origin) && /(?:^|\.)gercepos\.id$/i.test(origin.replace(/^https?:\/\//i, "").split("/")[0] || "")) {
    return origin.replace(/^http:/i, "https:");
  }
  return origin;
}

/** Absolute public invoice URL (UUID is the capability token). */
export function publicInvoiceUrl(paymentId: string, fallbackOrigin?: string) {
  return `${getPublicShareOrigin(fallbackOrigin)}/invoice/${paymentId}`;
}
