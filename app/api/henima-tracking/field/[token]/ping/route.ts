import { NextResponse } from "next/server";
import { dayWindow, resolveTrackingToken } from "@/lib/henima-tracking/service";
import { isSuspiciousJump } from "@/lib/henima-tracking/ping-guard";
import { forwardPingToTraccar } from "@/lib/henima-tracking/traccar";
import { salesDb } from "@/lib/henima-sales/db";
import { NotFoundError } from "@/lib/henima-sales/types";

export const runtime = "nodejs";

/**
 * Endpoint ringan untuk GPS native Android (otomatis, tanpa sales kirim manual).
 * Body: { lat, lng, accuracy_m?, mock?, provider? }
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const db = salesDb();
    const { staff } = await resolveTrackingToken(db, token);

    const body = await request.json().catch(() => ({}));
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = body?.accuracy_m == null ? null : Math.round(Number(body.accuracy_m));
    const mock = body?.mock === true || body?.mock === 1 || body?.mock === "1";

    if (mock) {
      return NextResponse.json({ error: "Lokasi palsu (mock GPS) ditolak." }, { status: 400 });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Lokasi tidak valid." }, { status: 400 });
    }
    if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return NextResponse.json({ error: "Akurasi tidak valid." }, { status: 400 });
    }
    // Titik terlalu kasar jarang berguna untuk pantau kinerja.
    if (accuracy != null && accuracy > 400) {
      return NextResponse.json({ ok: false, skipped: "akurasi_kasar" }, { status: 200 });
    }

    const win = dayWindow();
    const { data: lastRows } = await db
      .from("module_henima_tracking_points")
      .select("lat, lng, recorded_at")
      .eq("staff_id", staff.id)
      .gte("recorded_at", win.from)
      .lt("recorded_at", win.to)
      .order("recorded_at", { ascending: false })
      .limit(1);
    const last = lastRows?.[0];
    if (
      last &&
      isSuspiciousJump({
        fromLat: Number(last.lat),
        fromLng: Number(last.lng),
        fromAt: last.recorded_at,
        toLat: lat,
        toLng: lng,
      })
    ) {
      return NextResponse.json({ error: "Lompatan lokasi tidak wajar ditolak." }, { status: 400 });
    }

    const { error } = await db.rpc("henima_tracking_field_titik", {
      p_token: token.trim().toLowerCase(),
      p_lat: lat,
      p_lng: lng,
      p_accuracy_m: accuracy,
    });

    if (error) {
      const msg = error.message || "Gagal simpan titik.";
      if (msg.includes("SUDAH_CHECKOUT")) {
        return NextResponse.json({ ok: false, closed: true, error: msg }, { status: 409 });
      }
      if (msg.includes("BELUM_CHECKIN")) {
        return NextResponse.json({ ok: false, needCheckin: true, error: msg }, { status: 200 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Cadangan diam ke Traccar (kalau TRACCAR_OSMAND_URL di-set) — owner tetap pantau di Lokasi GPS.
    // Await supaya rename nama sales sempat selesai di Vercel (void sering terpotong).
    await forwardPingToTraccar({
      token,
      lat,
      lng,
      accuracy_m: accuracy,
      nama: staff.nama,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Link tidak berlaku." }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal." }, { status: 500 });
  }
}
