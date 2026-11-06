/**
 * GPS native Android — service terpisah dari WebView.
 * Titik tetap terkirim meski app di belakang / layar mati (mirip Grab).
 */

import { isNativeApp } from "@/lib/henima-tracking/native-geo";
import { isPastTrackingAutoClose } from "@/lib/henima-tracking/schedule";

type HenimaTrackPlugin = {
  start: (opts: { token: string; apiBase: string }) => Promise<{ ok?: boolean }>;
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

export async function startNativeBackgroundTrack(token: string) {
  const clean = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(clean)) return false;
  if (isPastTrackingAutoClose()) return false;
  const p = await plugin();
  if (!p) return false;
  try {
    await p.start({ token: clean, apiBase: apiBase() });
    // Minta bebas battery optimization sekali (OEM sering bunuh GPS).
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
