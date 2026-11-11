/**
 * Integrasi opsional ke Traccar.
 * Dashboard: NEXT_PUBLIC_TRACCAR_URL
 * Forward titik: TRACCAR_OSMAND_URL (protokol OsmAnd, default port 5055).
 * Rename device: TRACCAR_API_EMAIL + TRACCAR_API_PASSWORD (akun admin Traccar).
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

function cleanDeviceName(nama: string | null | undefined) {
  const raw = (nama || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return raw.slice(0, 80);
}

function sessionCookie(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const parts = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (parts.length) return parts.map((c) => c.split(";")[0]?.trim()).filter(Boolean).join("; ");
  const raw = res.headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=\s*[^;=]+=)/)
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function syncTraccarDeviceName(uniqueId: string, nama: string) {
  const base = traccarDashboardUrl();
  const email = (process.env.TRACCAR_API_EMAIL || "").trim();
  const password = (process.env.TRACCAR_API_PASSWORD || "").trim();
  if (!base || !email || !password || !nama) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const login = await fetch(`${base}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password }).toString(),
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
    });
    const cookie = sessionCookie(login);
    if (!login.ok || !cookie) return;

    const list = await fetch(`${base}/api/devices?uniqueId=${encodeURIComponent(uniqueId)}`, {
      headers: { Cookie: cookie },
      signal: controller.signal,
      cache: "no-store",
    });
    const devices = (await list.json().catch(() => [])) as Array<Record<string, unknown> & { id?: number; name?: string; uniqueId?: string }>;
    if (!list.ok || !Array.isArray(devices) || devices.length === 0) return;
    const device = devices.find((d) => d.uniqueId === uniqueId) || devices[0];
    if (!device?.id || device.name === nama) return;

    await fetch(`${base}/api/devices/${device.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ ...device, name: nama }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    /* diam — GPS HENIMA tetap jalan */
  } finally {
    clearTimeout(timer);
  }
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
    const ok = res.ok || res.status === 200;
    const nama = cleanDeviceName(opts.nama);
    if (ok && nama) {
      void syncTraccarDeviceName(id, nama);
    }
    return { ok, skipped: false as const, status: res.status, deviceId: id };
  } catch {
    return { ok: false as const, skipped: false as const, deviceId: id };
  }
}
