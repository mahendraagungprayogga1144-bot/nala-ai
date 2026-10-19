import { randomBytes } from "crypto";
import { addDaysYmd } from "@/lib/henima-sales/dates";
import { salesDb, type SalesDb } from "@/lib/henima-sales/db";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { loadTeamIds } from "@/lib/henima-sales/authz";
import { NotFoundError, SalesError } from "@/lib/henima-sales/types";
import type { Actor } from "@/lib/henima-sales/types";
import { todayWib } from "@/lib/date";
import { mapsUrl, TRACKING_KINDS, type TrackingKind, type TrackingLink, type TrackingPoint } from "./shared";

export { mapsUrl, TRACKING_KINDS };
export type { TrackingKind, TrackingLink, TrackingPoint };

const PHOTO_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const PHOTO_MAX = 5 * 1024 * 1024;
const BUCKET = "henima-tracking";

type LinkRow = {
  token: string;
  business_id: string;
  staff_id: string;
};

type StaffLite = {
  id: string;
  nama: string;
  role: string;
  status: string;
  business_id: string;
};

export function isMissingTrackingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /module_henima_tracking|schema cache|henima-tracking/i.test(message);
}

function wibHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export function dayWindow(ymd = todayWib()) {
  const next = addDaysYmd(ymd, 1);
  return { from: `${ymd}T00:00:00+07:00`, to: `${next}T00:00:00+07:00`, ymd };
}

function assertCoord(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new SalesError("Lokasi GPS tidak valid.", "gps_invalid");
  }
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function staffById(db: SalesDb, staffId: string) {
  const { data, error } = await db.from("module_sales_staff").select("id, nama, role, status, business_id").eq("id", staffId).maybeSingle();
  if (error) throw new SalesError(error.message, "staff_read");
  return (data as StaffLite | null) || null;
}

export async function resolveTrackingToken(db: SalesDb, token: string) {
  const clean = token.trim();
  if (!/^[a-f0-9]{32}$/i.test(clean)) throw new NotFoundError("Link tracking tidak berlaku.");
  const { data, error } = await db
    .from("module_henima_tracking_links")
    .select("token, business_id, staff_id")
    .eq("token", clean.toLowerCase())
    .maybeSingle();
  if (error) throw new SalesError(error.message, "tracking_link");
  const link = data as LinkRow | null;
  if (!link) throw new NotFoundError("Link tracking tidak berlaku.");
  const staff = await staffById(db, link.staff_id);
  if (!staff || staff.status === "disabled" || staff.business_id !== link.business_id) {
    throw new NotFoundError("Link tracking tidak berlaku.");
  }
  return { link, staff };
}

async function signPhoto(db: SalesDb, path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

function asPoint(row: {
  id: string;
  staff_id: string;
  kind: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  note: string | null;
  photo_path: string | null;
  late: boolean;
  recorded_at: string;
}, photoUrl: string | null): TrackingPoint {
  return {
    id: row.id,
    staff_id: row.staff_id,
    kind: row.kind as TrackingKind,
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy_m: row.accuracy_m,
    note: row.note,
    photo_path: row.photo_path,
    photo_url: photoUrl,
    late: Boolean(row.late),
    recorded_at: row.recorded_at,
  };
}

export async function listPointsForStaff(db: SalesDb, staffId: string, ymd = todayWib()) {
  const win = dayWindow(ymd);
  const { data, error } = await db
    .from("module_henima_tracking_points")
    .select("id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late, recorded_at")
    .eq("staff_id", staffId)
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to)
    .order("recorded_at", { ascending: false })
    .limit(200);
  if (error) throw new SalesError(error.message, "tracking_points");
  const rows = data || [];
  const signed = await Promise.all(
    rows.map((row) => (row.kind === "ping" ? Promise.resolve(null) : signPhoto(db, row.photo_path))),
  );
  return rows.map((row, i) => asPoint(row, signed[i]));
}

export async function publicTrackingState(token: string) {
  const db = salesDb();
  const { staff } = await resolveTrackingToken(db, token);
  const points = await listPointsForStaff(db, staff.id);
  const hour = wibHour();
  return {
    nama: staff.nama,
    role: staff.role,
    date: todayWib(),
    hour,
    lateWindow: hour >= 9,
    beforeDuty: hour < 7,
    checkedIn: points.some((p) => p.kind === "checkin_pagi"),
    checkedOut: points.some((p) => p.kind === "checkin_sore"),
    points: points.map((p) => ({
      id: p.id,
      kind: p.kind,
      lat: p.lat,
      lng: p.lng,
      accuracy_m: p.accuracy_m,
      note: p.note,
      late: p.late,
      recorded_at: p.recorded_at,
      maps: mapsUrl(p.lat, p.lng),
      photo_url: p.photo_url,
    })),
  };
}

async function latestPoint(db: SalesDb, staffId: string) {
  const { data } = await db
    .from("module_henima_tracking_points")
    .select("lat, lng, recorded_at, kind")
    .eq("staff_id", staffId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { lat: number; lng: number; recorded_at: string; kind: string } | null;
}

export async function recordTrackingPoint(
  token: string,
  input: {
    kind: TrackingKind;
    lat: number;
    lng: number;
    accuracy?: number | null;
    note?: string | null;
    photo?: { bytes: Uint8Array; mime: string } | null;
  },
) {
  if (!TRACKING_KINDS.includes(input.kind)) throw new SalesError("Jenis catatan tidak valid.", "kind_invalid");
  assertCoord(input.lat, input.lng);
  const db = salesDb();
  const { link, staff } = await resolveTrackingToken(db, token);
  const win = dayWindow();

  const { count: checkedOut } = await db
    .from("module_henima_tracking_points")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", staff.id)
    .eq("kind", "checkin_sore")
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to);
  if (checkedOut) {
    throw new SalesError("Sudah check-out. Hari ini tidak bisa check-in atau mencatat lokasi lagi.", "checked_out");
  }

  if (input.kind === "checkin_pagi" || input.kind === "checkin_sore") {
    const { count } = await db
      .from("module_henima_tracking_points")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", staff.id)
      .eq("kind", input.kind)
      .gte("recorded_at", win.from)
      .lt("recorded_at", win.to);
    if (count) {
      throw new SalesError(
        input.kind === "checkin_pagi" ? "Check-in pagi hari ini sudah tercatat." : "Check-in sore hari ini sudah tercatat.",
        input.kind === "checkin_pagi" ? "already_checked_in" : "already_checked_out",
      );
    }
  }
  if (input.kind === "checkin_pagi" && !input.photo) {
    throw new SalesError("Check-in pagi butuh foto lokasi.", "photo_required");
  }
  if ((input.kind === "checkin_pagi" || input.kind === "checkin_sore" || input.kind === "visit") && input.accuracy != null && input.accuracy > 250) {
    throw new SalesError("Sinyal GPS masih kasar. Ambil lokasi lagi di tempat terbuka.", "gps_coarse");
  }

  if (input.kind === "ping") {
    const last = await latestPoint(db, staff.id);
    if (last) {
      const age = Date.now() - new Date(last.recorded_at).getTime();
      const moved = distanceMeters({ lat: Number(last.lat), lng: Number(last.lng) }, input);
      if (age < 60_000 && moved < 40) {
        return { skipped: true as const };
      }
    }
  }

  let photoPath: string | null = null;
  if (input.photo) {
    if (!PHOTO_MIME.has(input.photo.mime)) throw new SalesError("Foto harus JPG, PNG, atau WEBP.", "file_type");
    if (input.photo.bytes.byteLength > PHOTO_MAX) throw new SalesError("Foto maksimal 5MB.", "file_size");
    const ext = input.photo.mime.includes("png") ? "png" : input.photo.mime.includes("webp") ? "webp" : "jpg";
    photoPath = `${link.business_id}/${staff.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(photoPath, input.photo.bytes, {
      contentType: input.photo.mime,
      upsert: false,
    });
    if (upErr) throw new SalesError("Upload foto gagal. Coba lagi.", "upload_failed", 502);
  }

  const note = (input.note || "").replace(/\s+/g, " ").trim().slice(0, 180) || null;
  const late = input.kind === "checkin_pagi" && wibHour() >= 9;
  const { error } = await db.from("module_henima_tracking_points").insert({
    business_id: link.business_id,
    staff_id: staff.id,
    kind: input.kind,
    lat: input.lat,
    lng: input.lng,
    accuracy_m: input.accuracy != null && Number.isFinite(input.accuracy) ? Math.round(input.accuracy) : null,
    note: input.kind === "visit" ? note : note,
    photo_path: photoPath,
    late,
  });
  if (error) throw new SalesError(error.message, "tracking_insert");
  return { skipped: false as const };
}

export async function ensureTrackingLinks(db: SalesDb, actor: Actor): Promise<TrackingLink[]> {
  const staff = (await listStaff(db, actor)).filter((row) => row.status !== "disabled" && row.role !== "FOUNDER");
  if (!staff.length) return [];
  const ids = staff.map((row) => row.id);
  const { data, error } = await db
    .from("module_henima_tracking_links")
    .select("staff_id, token")
    .eq("business_id", actor.businessId)
    .in("staff_id", ids);
  if (error) throw new SalesError(error.message, "tracking_links");
  const have = new Map((data || []).map((row: { staff_id: string; token: string }) => [row.staff_id, row.token]));
  const missing = staff.filter((row) => !have.has(row.id));
  if (missing.length) {
    const { error: insErr } = await db.from("module_henima_tracking_links").insert(
      missing.map((row) => ({
        business_id: actor.businessId,
        staff_id: row.id,
        token: randomBytes(16).toString("hex"),
      })),
    );
    if (insErr) throw new SalesError(insErr.message, "tracking_link_create");
    const { data: again, error: againErr } = await db
      .from("module_henima_tracking_links")
      .select("staff_id, token")
      .eq("business_id", actor.businessId)
      .in("staff_id", ids);
    if (againErr) throw new SalesError(againErr.message, "tracking_links");
    have.clear();
    for (const row of again || []) have.set(row.staff_id, row.token);
  }
  return staff.map((row) => {
    const token = have.get(row.id) || "";
    return {
      staffId: row.id,
      nama: row.nama,
      role: row.role,
      status: row.status,
      token,
      path: `/t/${token}`,
    };
  });
}

export async function loadTrackingDesk(db: SalesDb, actor: Actor) {
  const links = await ensureTrackingLinks(db, actor);
  const win = dayWindow();
  let q = db
    .from("module_henima_tracking_points")
    .select("id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late, recorded_at")
    .eq("business_id", actor.businessId)
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to)
    .order("recorded_at", { ascending: false })
    .limit(400);
  if (actor.role !== "FOUNDER") {
    const teamIds = await loadTeamIds(db, actor);
    const ids = links.map((row) => row.staffId);
    const allowed = actor.role === "LEADER" ? ids.filter((id) => id === actor.staffId || teamIds.includes(id)) : [actor.staffId];
    q = q.in("staff_id", allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data, error } = await q;
  if (error) throw new SalesError(error.message, "tracking_desk");
  const rows = data || [];
  const signed = await Promise.all(rows.map((row) => (row.photo_path ? signPhoto(db, row.photo_path) : Promise.resolve(null))));
  return {
    date: win.ymd,
    links,
    points: rows.map((row, i) => asPoint(row, signed[i])),
  };
}
