import { randomBytes } from "crypto";
import { addDaysYmd } from "@/lib/henima-sales/dates";
import { salesDb, type SalesDb } from "@/lib/henima-sales/db";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { NotFoundError, SalesError } from "@/lib/henima-sales/types";
import type { Actor } from "@/lib/henima-sales/types";
import { todayWib } from "@/lib/date";
import { mapsUrl, qrisStorageCandidates, qrisStoragePath, type TrackingKind, type TrackingLink, type TrackingPoint } from "./shared";

export { mapsUrl, qrisStoragePath };
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
  return /does not exist|schema cache|could not find the table/i.test(message) && /module_henima_tracking|henima-tracking/i.test(message);
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

export async function loadQrisUrl(db: SalesDb, businessId: string) {
  for (const path of qrisStorageCandidates(businessId)) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
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
  const staff = (await listStaff(db, actor)).filter((row) => row.status !== "disabled");
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
    const rows = missing.map((row) => ({
      business_id: actor.businessId,
      staff_id: row.id,
      token: randomBytes(16).toString("hex"),
    }));
    const { error: insErr } = await db.from("module_henima_tracking_links").insert(rows);
    if (insErr) throw new SalesError(insErr.message, "tracking_link_create");
    for (const row of rows) have.set(row.staff_id, row.token);
  }
  return staff.flatMap((row) => {
    const token = have.get(row.id) || "";
    if (!/^[a-f0-9]{32}$/i.test(token)) return [];
    return [
      {
        staffId: row.id,
        nama: row.nama,
        role: row.role,
        status: row.status,
        token,
        path: `/t/${token}`,
        terhubung: Boolean(row.user_id),
      },
    ];
  });
}

export async function loadVisiblePoints(
  db: SalesDb,
  ymd = todayWib(),
  opts?: { skipPhotos?: boolean },
) {
  const win = dayWindow(ymd);
  const { data, error } = await db
    .from("module_henima_tracking_points")
    .select("id, business_id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late, recorded_at")
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to)
    .order("recorded_at", { ascending: false })
    .limit(1500);
  if (error) throw new SalesError(error.message, "tracking_read");
  const rows = data || [];
  if (opts?.skipPhotos) {
    return {
      date: win.ymd,
      points: rows.map((row) => asPoint(row, null)),
    };
  }
  // Tanda tangan foto hanya untuk galeri (bukan setiap ping). Maks 24 biar ganti hari cepat.
  const photoRows = rows.filter((row) => row.photo_path && row.kind !== "ping" && row.kind !== "qris").slice(0, 24);
  const signedList = await Promise.all(photoRows.map((row) => signPhoto(db, row.photo_path)));
  const signedByPath = new Map(photoRows.map((row, i) => [row.photo_path as string, signedList[i]]));
  const businessId = rows[0]?.business_id as string | undefined;
  const qrisUrl = businessId && rows.some((row) => row.kind === "qris") ? await loadQrisUrl(db, businessId) : null;
  return {
    date: win.ymd,
    points: rows.map((row) =>
      asPoint(
        row,
        row.kind === "qris"
          ? qrisUrl
          : row.photo_path
            ? signedByPath.get(row.photo_path) || null
            : null,
      ),
    ),
  };
}

export async function loadTrackingDays(db: SalesDb) {
  const since = addDaysYmd(todayWib(), -120);
  const { data, error } = await db
    .from("module_henima_tracking_points")
    .select("recorded_at")
    .in("kind", ["checkin_pagi", "visit", "checkin_sore", "qris"])
    .gte("recorded_at", `${since}T00:00:00+07:00`)
    .order("recorded_at", { ascending: false })
    .limit(800);
  if (error) return [] as string[];
  const days: string[] = [];
  for (const row of data || []) {
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(row.recorded_at));
    if (!days.includes(ymd)) days.push(ymd);
  }
  return days;
}

export async function loadTrackingDesk(admin: SalesDb, session: SalesDb, actor: Actor, ymd = todayWib()) {
  let links: TrackingLink[] = [];
  let notice = "";
  try {
    links = await ensureTrackingLinks(admin, actor);
  } catch (err) {
    notice = err instanceof Error ? err.message : "Link check-in gagal dibuat.";
  }
  const [visible, days, qrisUrl] = await Promise.all([
    loadVisiblePoints(session, ymd),
    loadTrackingDays(session),
    loadQrisUrl(admin, actor.businessId),
  ]);
  return { date: visible.date, today: todayWib(), days, links, points: visible.points, notice, qrisUrl };
}
