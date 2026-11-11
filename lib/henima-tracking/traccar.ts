/**
 * Integrasi opsional ke Traccar.
 * Dashboard: NEXT_PUBLIC_TRACCAR_URL (iframe di modul Henima).
 * Forward titik: TRACCAR_OSMAND_URL (protokol OsmAnd, default port 5055).
 */

export function traccarDashboardUrl() {
  const raw = (process.env.NEXT_PUBLIC_TRACCAR_URL || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function osmAndBase() {
  const raw = (process.env.TRACCAR_OSMAND_URL || process.env.NEXT_PUBLIC_TRACCAR_OSMAND_URL || "").trim();
  if (raw) {
    try {
      return new URL(raw).toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  }
  // Lokal default kalau dashboard Traccar juga lokal.
  const dash = traccarDashboardUrl();
  if (dash.includes("127.0.0.1") || dash.includes("localhost")) {
    return "http://127.0.0.1:5055";
  }
  return "";
}

/** ID device Traccar dari token link sales (stabil per sales). */
export function traccarDeviceId(token: string) {
  const clean = token.trim().toLowerCase().replace(/[^a-f0-9]/g, "");
  return `henima-${clean.slice(0, 16) || "unknown"}`;
}

/**
 * Kirim satu titik ke Traccar (OsmAnd). Tidak melempar — gagal diam agar GPS HENIMA tetap jalan.
 * https://www.traccar.org/osmand/
 */
export async function forwardPingToTraccar(opts: {
  token: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  nama?: string | null;
}) {
  const base = osmAndBase();
  if (!base) return { ok: false as const, skipped: true as const };

  const id = traccarDeviceId(opts.token);
  const params = new URLSearchParams({
    id,
    lat: String(opts.lat),
    lon: String(opts.lng),
    timestamp: String(Math.floor(Date.now() / 1000)),
    speed: "0",
    bearing: "0",
    altitude: "0",
  });
  if (opts.accuracy_m != null && Number.isFinite(opts.accuracy_m)) {
    // hdop ~ akurasi kasar (meter) agar Traccar bisa filter titik jelek.
    params.set("hdop", String(Math.max(0.5, Math.min(50, Number(opts.accuracy_m) / 5))));
    params.set("accuracy", String(Math.round(opts.accuracy_m)));
  }

  const url = `${base}/?${params.toString()}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return { ok: res.ok || res.status === 200, skipped: false as const, status: res.status, deviceId: id };
  } catch {
    return { ok: false as const, skipped: false as const, deviceId: id };
  }
}
