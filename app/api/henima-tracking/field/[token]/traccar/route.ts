import { NextResponse } from "next/server";
import { resolveTrackingToken } from "@/lib/henima-tracking/service";
import { forwardPingToTraccar } from "@/lib/henima-tracking/traccar";
import { salesDb } from "@/lib/henima-sales/db";
import { NotFoundError } from "@/lib/henima-sales/types";

export const runtime = "nodejs";

/** Cadangan diam ke Traccar saat check-in / kunjungan (bukan ganti simpan HENIMA). */
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

    const result = await forwardPingToTraccar({
      token,
      lat,
      lng,
      accuracy_m: accuracy,
    });

    return NextResponse.json({ ok: Boolean(result.ok), skipped: Boolean(result.skipped), deviceId: result.deviceId ?? null });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Link tidak berlaku." }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal." }, { status: 500 });
  }
}
