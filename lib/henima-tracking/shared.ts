export const TRACKING_KINDS = ["checkin_pagi", "checkin_sore", "visit", "ping"] as const;
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
};

export function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
