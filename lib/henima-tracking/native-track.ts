/**
 * GPS native Android — service terpisah dari WebView.
 * Titik ke HENIMA + opsional langsung ke server Traccar (OsmAnd), tanpa Traccar Client.
 */

import { isNativeApp } from "@/lib/henima-tracking/native-geo";
import { isPastTrackingAutoClose } from "@/lib/henima-tracking/schedule";

type HenimaTrackPlugin = {
  start: (opts: { token: string; apiBase: string; traccarOsmAnd?: string }) => Promise<{ ok?: boolean }>;
  stop: () => Promise<{ ok?: boolean }>;
  isRunning: () => Promise<{ running?: boolean }>;
  requestIgnoreBatteryOptimizations: () => Promise<{ ok?: boolean }>;
};

async function plugin(): Promise<HenimaTrackPlugin | null> {
  if (!(await isNativeApp())) return null;
  try {
    const { registerPlugin } = await import("@capacitor/core");
    return registerPlugin<HenimaTrackPlugin>("HenimaTrack");
  } catch {
    return null;
  }
}

function apiBase() {
  if (typeof window === "undefined") return "https://www.gercepos.id";
  return window.location.origin || "https://www.gercepos.id";
}

/** URL OsmAnd Traccar publik (bukan 127.0.0.1 kalau sales di lapangan). */
function traccarOsmAndUrl() {
  const raw = (process.env.NEXT_PUBLIC_TRACCAR_OSMAND_URL || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    // Localhost tidak berguna di HP sales di luar.
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export async function startNativeBackgroundTrack(token: string) {
  const clean = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(clean)) return false;
  if (isPastTrackingAutoClose()) return false;
  const p = await plugin();
  if (!p) return false;
  try {
    await p.start({
      token: clean,
      apiBase: apiBase(),
      traccarOsmAnd: traccarOsmAndUrl(),
    });
    try {
      await p.requestIgnoreBatteryOptimizations();
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeBackgroundTrack() {
  const p = await plugin();
  if (!p) return;
  try {
    await p.stop();
  } catch {
    /* ignore */
  }
}

export async function isNativeBackgroundTrackRunning() {
  const p = await plugin();
  if (!p) return false;
  try {
    const r = await p.isRunning();
    return Boolean(r.running);
  } catch {
    return false;
  }
}

/** Buka pengaturan “abaikan optimasi baterai” (Android native). */
export async function requestNativeIgnoreBatteryOptimizations() {
  const p = await plugin();
  if (!p) return { ok: false as const, native: false as const };
  try {
    await p.requestIgnoreBatteryOptimizations();
    return { ok: true as const, native: true as const };
  } catch {
    return { ok: false as const, native: true as const };
  }
}
