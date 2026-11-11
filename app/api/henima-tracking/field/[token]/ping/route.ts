import { NextResponse } from "next/server";
import { resolveTrackingToken } from "@/lib/henima-tracking/service";
import { salesDb } from "@/lib/henima-sales/db";
import { NotFoundError } from "@/lib/henima-sales/types";

export const runtime = "nodejs";

/**
 * Endpoint ringan untuk GPS native Android (jalan meski WebView ditutup).
 * Body: { lat, lng, accuracy_m? }
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const db = salesDb();
    await resolveTrackingToken(db, token);

    const body = await request.json().catch(() => ({}));
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = body?.accuracy_m == null ? null : Math.round(Number(body.accuracy_m));

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Lokasi tidak valid." }, { status: 400 });
    }
    if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return NextResponse.json({ error: "Akurasi tidak valid." }, { status: 400 });
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
      // Jangan matikan service native untuk error non-checkout (mis. schema lama).
      if (msg.includes("BELUM_CHECKIN")) {
        return NextResponse.json({ ok: false, needCheckin: true, error: msg }, { status: 200 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Link tidak berlaku." }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal." }, { status: 500 });
  }
}
