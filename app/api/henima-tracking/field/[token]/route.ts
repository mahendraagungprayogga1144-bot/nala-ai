import { NextResponse } from "next/server";
import { dayWindow, loadQrisUrl, resolveTrackingToken } from "@/lib/henima-tracking/service";
import { mapsUrl } from "@/lib/henima-tracking/shared";
import { salesDb } from "@/lib/henima-sales/db";
import { NotFoundError } from "@/lib/henima-sales/types";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const db = salesDb();
    const { link, staff } = await resolveTrackingToken(db, token);
    const win = dayWindow();
    const [{ data, error }, qrisUrl] = await Promise.all([
      db
        .from("module_henima_tracking_points")
        .select("id, staff_id, kind, lat, lng, accuracy_m, note, photo_path, late, recorded_at")
        .eq("staff_id", staff.id)
        .gte("recorded_at", win.from)
        .lt("recorded_at", win.to)
        .order("recorded_at", { ascending: false })
        .limit(200),
      loadQrisUrl(db, link.business_id),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const points = await Promise.all(
      (data || []).map(async (row) => {
        let photo_url: string | null = null;
        if (row.kind === "qris") photo_url = qrisUrl;
        else if (row.photo_path && row.kind !== "ping") {
          const signed = await db.storage.from("henima-tracking").createSignedUrl(row.photo_path, 60 * 60);
          photo_url = signed.data?.signedUrl || null;
        }
        return {
          id: row.id,
          kind: row.kind,
          lat: Number(row.lat),
          lng: Number(row.lng),
          accuracy_m: row.accuracy_m,
          note: row.note,
          late: Boolean(row.late),
          recorded_at: row.recorded_at,
          maps: mapsUrl(Number(row.lat), Number(row.lng)),
          photo_url,
        };
      }),
    );

    return NextResponse.json({
      date: win.ymd,
      points,
      checkedIn: points.some((point) => point.kind === "checkin_pagi"),
      checkedOut: points.some((point) => point.kind === "checkin_sore"),
      qrisUrl,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Link tidak berlaku." }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal memuat." }, { status: 500 });
  }
}
