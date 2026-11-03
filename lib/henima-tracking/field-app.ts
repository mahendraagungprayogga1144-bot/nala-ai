/** Cookie yang menandai WebView app Henima Sales (bukan browser biasa). */
export const HENIMA_FIELD_APP_COOKIE = "henima_field_app";

const LAST_TOKEN_KEY = "henima_field_last_token";

/** Path yang boleh diakses dari app lapangan — sisanya diblok ke /t. */
export function isFieldAppAllowedPath(pathname: string) {
  if (pathname === "/t" || pathname.startsWith("/t/")) return true;
  if (pathname.startsWith("/api/henima-tracking/field")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/icon")) return true;
  if (pathname === "/favicon.ico" || pathname === "/apple-touch-icon.png") return true;
  if (pathname.startsWith("/manifest")) return true;
  if (pathname === "/sw.js" || pathname.startsWith("/workbox")) return true;
  return false;
}

/** URL APK yang bisa diunduh sales (host di Drive/Blob/CDN). */
export function getHenimaSalesApkUrl() {
  const raw = process.env.NEXT_PUBLIC_HENIMA_SALES_APK_URL?.trim();
  return raw || "";
}

export function fieldTokenStorageKey() {
  return LAST_TOKEN_KEY;
}

export function rememberFieldToken(token: string) {
  if (typeof window === "undefined") return;
  const clean = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(clean)) return;
  try {
    window.localStorage.setItem(LAST_TOKEN_KEY, clean);
  } catch {
    /* ignore */
  }
}

export function readRememberedFieldToken() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
