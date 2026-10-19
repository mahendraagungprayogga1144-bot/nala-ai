import { randomBytes } from "crypto";
import { addDaysYmd } from "@/lib/henima-sales/dates";
import { salesDb, type SalesDb } from "@/lib/henima-sales/db";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { NotFoundError, SalesError } from "@/lib/henima-sales/types";
import type { Actor } from "@/lib/henima-sales/types";
import { todayWib } from "@/lib/date";
import { mapsUrl, type TrackingKind, type TrackingLink, type TrackingPoint } from "./shared";

export { mapsUrl };
export type { TrackingLink, TrackingPoint };

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

export function dayWindow(ymd = todayWib()) {
  const next = addDaysYmd(ymd, 1);
  return { from: `${ymd}T00:00:00+07:00`, to: `${next}T00:00:00+07:00`, ymd };
}

function wibHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
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

export async function publicTrackingState(token: string) {
  const db = salesDb();
  const { link, staff } = await resolveTrackingToken(db, token);
  const hour = wibHour();
  return {
    nama: staff.nama,
    role: staff.role,
    staffId: staff.id,
    businessId: link.business_id,
    date: todayWib(),
    hour,
    lateWindow: hour >= 9,
    beforeDuty: hour < 7,
    checkedIn: false,
    checkedOut: false,
    points: [] as {
      id: string;
      kind: TrackingPoint["kind"];
      lat: number;
      lng: number;
      accuracy_m: number | null;
      note: string | null;
      late: boolean;
      recorded_at: string;
      maps: string;
      photo_url: string | null;
    }[],
  };
}

export async function ensureTrackingLinks(db: SalesDb, actor: Actor): Promise<TrackingLink[]> {
  const staff = (await listStaff(db, actor)).filter((row) => row.status === "active");
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
      terhubung: Boolean(row.user_id),
    };
  });
}

export async function loadVisiblePoints(db: SalesDb) {
  const win = dayWindow();
  const { data, error } = await db
    .from("module_henima_tracking_points")
    .select("id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late, recorded_at")
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to)
    .order("recorded_at", { ascending: false })
    .limit(400);
  if (error) throw new SalesError(error.message, "tracking_read");
  const rows = data || [];
  const signed = await Promise.all(rows.map((row) => (row.photo_path ? signPhoto(db, row.photo_path) : Promise.resolve(null))));
  return {
    date: win.ymd,
    points: rows.map((row, i) => asPoint(row, signed[i])),
  };
}

export async function loadTrackingDesk(admin: SalesDb, session: SalesDb, actor: Actor) {
  const links = await ensureTrackingLinks(admin, actor);
  const visible = await loadVisiblePoints(session);
  return { date: visible.date, links, points: visible.points };
}
