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
  if (pathname.startsWith("/manifest") || pathname.startsWith("/t/manifest")) return true;
  if (pathname.startsWith("/downloads/")) return true;
  if (pathname === "/sw.js" || pathname.startsWith("/workbox")) return true;
  return false;
}

/** Versi APK yang terpasang di build portal ini (naikkan bareng APK). */
export const HENIMA_APP_VERSION = "1.4.1";
export const HENIMA_APP_VERSION_CODE = 7;

/** URL APK yang bisa diunduh sales (env override, atau file di /downloads). */
export function getHenimaSalesApkUrl() {
  const raw = process.env.NEXT_PUBLIC_HENIMA_SALES_APK_URL?.trim();
  if (raw) return raw;
  return "/downloads/henima-sales.apk";
}

export type HenimaApkRelease = {
  versionName: string;
  versionCode: number;
  apkPath: string;
  notes?: string;
};

/** Manifest versi di CDN/public — dipakai cek pembaruan di app lapangan. */
export function getHenimaSalesVersionUrl() {
  return "/downloads/henima-sales-version.json";
}

export async function fetchHenimaApkRelease(): Promise<HenimaApkRelease | null> {
  try {
    const res = await fetch(`${getHenimaSalesVersionUrl()}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<HenimaApkRelease>;
    const versionCode = Number(json.versionCode);
    const versionName = String(json.versionName || "").trim();
    if (!Number.isFinite(versionCode) || versionCode < 1 || !versionName) return null;
    return {
      versionName,
      versionCode,
      apkPath: String(json.apkPath || getHenimaSalesApkUrl()).trim() || getHenimaSalesApkUrl(),
      notes: typeof json.notes === "string" ? json.notes : undefined,
    };
  } catch {
    return null;
  }
}

export function isHenimaApkUpdateAvailable(latest: HenimaApkRelease | null, installedCode = HENIMA_APP_VERSION_CODE) {
  if (!latest) return false;
  return latest.versionCode > installedCode;
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

export function clearRememberedFieldToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
