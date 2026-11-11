/** Guard ping GPS: tolak mock / lompatan tidak wajar (anti manipulasi kasar). */

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * true = curiga dimanipulasi / tidak masuk akal.
 * Kecepatan kasar > ~160 km/jam antar titik berjarak jauh = teleport fake GPS.
 */
export function isSuspiciousJump(opts: {
  fromLat: number;
  fromLng: number;
  fromAt: string | Date;
  toLat: number;
  toLng: number;
  toAt?: Date;
}) {
  const fromMs = new Date(opts.fromAt).getTime();
  const toMs = (opts.toAt || new Date()).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return false;
  const dtSec = Math.max(1, (toMs - fromMs) / 1000);
  const meters = haversineMeters(opts.fromLat, opts.fromLng, opts.toLat, opts.toLng);
  if (meters < 800) return false;
  const kmh = (meters / 1000) / (dtSec / 3600);
  // Motor/mobil lapangan jarang > 160 km/jam kontinu; 200+ antar titik = curiga.
  return kmh > 200;
}
