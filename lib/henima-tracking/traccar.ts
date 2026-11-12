/**
 * Integrasi opsional ke Traccar.
 * Dashboard: NEXT_PUBLIC_TRACCAR_URL (wajib ada :8082 kalau UI di port itu)
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

function apiEmail() {
  return (process.env.TRACCAR_API_EMAIL || "").trim();
}

function apiPassword() {
  return (process.env.TRACCAR_API_PASSWORD || "").trim();
}

function basicAuthHeader() {
  const email = apiEmail();
  const password = apiPassword();
  if (!email || !password) return "";
  return `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
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

async function fetchDevices(base: string, headers: Record<string, string>, signal: AbortSignal) {
  const res = await fetch(`${base}/api/devices`, {
    headers: { Accept: "application/json", ...headers },
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const devices = (await res.json().catch(() => null)) as Array<
    Record<string, unknown> & { id?: number; name?: string; uniqueId?: string }
  > | null;
  return Array.isArray(devices) ? devices : null;
}

async function putDeviceName(
  base: string,
  headers: Record<string, string>,
  device: Record<string, unknown> & { id: number },
  nama: string,
  signal: AbortSignal,
) {
  const res = await fetch(`${base}/api/devices/${device.id}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ ...device, name: nama }),
    signal,
    cache: "no-store",
  });
  return res.ok;
}

/** Ganti name device di Traccar biar tampil nama sales, bukan henima-xxxx. */
async function syncTraccarDeviceName(uniqueId: string, nama: string) {
  const base = traccarDashboardUrl();
  const email = apiEmail();
  const password = apiPassword();
  if (!base || !email || !password || !nama) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // 1) Basic auth (paling cocok di Vercel serverless)
    const basic = basicAuthHeader();
    if (basic) {
      const devices = await fetchDevices(base, { Authorization: basic }, controller.signal);
      const device = devices?.find((d) => d.uniqueId === uniqueId);
      if (device?.id && device.name !== nama) {
        const ok = await putDeviceName(base, { Authorization: basic }, { ...device, id: device.id }, nama, controller.signal);
        if (ok) return;
      }
    }

    // 2) Fallback session cookie
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

    const devices = await fetchDevices(base, { Cookie: cookie }, controller.signal);
    const device = devices?.find((d) => d.uniqueId === uniqueId);
    if (!device?.id || device.name === nama) return;
    await putDeviceName(base, { Cookie: cookie }, { ...device, id: device.id }, nama, controller.signal);
  } catch {
    /* diam — GPS HENIMA tetap jalan */
  } finally {
    clearTimeout(timer);
  }
}

/** Arah gerak (derajat 0–360) dari dua titik lat/lng. */
export function bearingBetween(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δλ = toRad(toLng - fromLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
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
  /** Derajat 0–360 — panah arah di peta Traccar */
  bearing?: number | null;
  /** m/s — OsmAnd expects knots-ish via speed; we send m/s * 1.94384 if needed; Traccar OsmAnd uses knots in some versions — send km/h via `speed` as documented: speed in knots. Use m/s * 1.943844. */
  speed_mps?: number | null;
}) {
  const base = osmAndBase();
  if (!base) return { ok: false as const, skipped: true as const };

  const id = traccarDeviceId(opts.token);
  const bearing =
    opts.bearing != null && Number.isFinite(opts.bearing)
      ? Math.max(0, Math.min(360, Number(opts.bearing)))
      : 0;
  const speedKnots =
    opts.speed_mps != null && Number.isFinite(opts.speed_mps) && opts.speed_mps > 0
      ? Math.max(0, Number(opts.speed_mps) * 1.943844)
      : 0;
  const params = new URLSearchParams({
    id,
    lat: String(opts.lat),
    lon: String(opts.lng),
    timestamp: String(Math.floor(Date.now() / 1000)),
    speed: String(speedKnots),
    bearing: String(bearing),
    altitude: "0",
  });
  if (opts.accuracy_m != null && Number.isFinite(opts.accuracy_m)) {
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
      await syncTraccarDeviceName(id, nama);
    }
    return { ok, skipped: false as const, status: res.status, deviceId: id };
  } catch {
    return { ok: false as const, skipped: false as const, deviceId: id };
  }
}
