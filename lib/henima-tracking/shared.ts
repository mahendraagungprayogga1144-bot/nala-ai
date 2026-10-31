export const TRACKING_KINDS = ["checkin_pagi", "checkin_sore", "visit", "ping", "qris"] as const;

export function qrisStoragePath(businessId: string, ext: "jpg" | "png" | "webp" = "jpg") {
  return `${businessId}/qris/primary.${ext}`;
}

export function qrisStorageCandidates(businessId: string) {
  return [
    qrisStoragePath(businessId, "jpg"),
    qrisStoragePath(businessId, "png"),
    qrisStoragePath(businessId, "webp"),
  ];
}
export type TrackingKind = (typeof TRACKING_KINDS)[number];

export type TrackingPoint = {
  id: string;
  staff_id: string;
  kind: TrackingKind;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  note: string | null;
  photo_path: string | null;
  photo_url: string | null;
  late: boolean;
  recorded_at: string;
};

export type TrackingLink = {
  staffId: string;
  nama: string;
  role: string;
  status: string;
  token: string;
  path: string;
  terhubung: boolean;
};

export function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/** Batas hari kalender WIB, sama dengan function database. */
export function wibDayWindow(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextYmd = next.toISOString().slice(0, 10);
  return { from: `${ymd}T00:00:00+07:00`, to: `${nextYmd}T00:00:00+07:00`, ymd };
}
