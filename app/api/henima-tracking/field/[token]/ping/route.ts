import { after, NextResponse } from "next/server";
import { dayWindow, resolveTrackingToken } from "@/lib/henima-tracking/service";
import { isSuspiciousJump } from "@/lib/henima-tracking/ping-guard";
import { bearingBetween, forwardPingToTraccar } from "@/lib/henima-tracking/traccar";
import { notifyOwnerIncident, watchSilentForBusiness } from "@/lib/henima-tracking/silent-watch";
import { ownerBotConfigured } from "@/lib/henima-tracking/owner-bot";
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
      if (ownerBotConfigured()) {
        after(async () => {
          try {
            await notifyOwnerIncident(db, {
              businessId: staff.business_id,
              staffId: staff.id,
              nama: staff.nama,
              kind: "mock",
            });
          } catch {
            /* ignore */
          }
        });
      }
      return NextResponse.json({ error: "Lokasi palsu (mock GPS) ditolak." }, { status: 400 });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Lokasi tidak valid." }, { status: 400 });
    }
    if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return NextResponse.json({ error: "Akurasi tidak valid." }, { status: 400 });
    }
    // Titik terlalu kasar jarang berguna untuk pantau kinerja — tetap sweep HRD.
    if (accuracy != null && accuracy > 400) {
      if (ownerBotConfigured()) {
        const businessId = staff.business_id;
        after(async () => {
          try {
            await watchSilentForBusiness(db, businessId);
          } catch {
            /* ignore */
          }
        });
      }
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
      if (ownerBotConfigured()) {
        after(async () => {
          try {
            await notifyOwnerIncident(db, {
              businessId: staff.business_id,
              staffId: staff.id,
              nama: staff.nama,
              kind: "lompatan",
              detail: "Titik meloncat terlalu cepat dibanding GPS sebelumnya hari ini.",
            });
          } catch {
            /* ignore */
          }
        });
      }
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
    let bearing: number | null = null;
    let speed_mps: number | null = null;
    const bodyBearing = body?.bearing ?? body?.heading;
    const bodySpeed = body?.speed_mps ?? body?.speed;
    if (bodyBearing != null && Number.isFinite(Number(bodyBearing))) {
      bearing = Number(bodyBearing);
    } else if (last) {
      const distRough =
        Math.hypot(lat - Number(last.lat), lng - Number(last.lng)) * 111_000;
      if (distRough > 3) {
        bearing = bearingBetween(Number(last.lat), Number(last.lng), lat, lng);
        const dtSec = Math.max(
          1,
          (Date.now() - new Date(last.recorded_at).getTime()) / 1000,
        );
        speed_mps = Math.min(40, distRough / dtSec);
      }
    }
    if (bodySpeed != null && Number.isFinite(Number(bodySpeed))) {
      speed_mps = Number(bodySpeed);
    }
    await forwardPingToTraccar({
      token,
      lat,
      lng,
      accuracy_m: accuracy,
      nama: staff.nama,
      bearing,
      speed_mps,
    });

    // Bot asisten owner: cek rekan Senyap tanpa ganggu bot sales.
    if (ownerBotConfigured()) {
      const businessId = staff.business_id;
      after(async () => {
        try {
          await watchSilentForBusiness(db, businessId);
        } catch {
          /* ignore */
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Link tidak berlaku." }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal." }, { status: 500 });
  }
}
