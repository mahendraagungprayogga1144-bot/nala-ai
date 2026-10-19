import { NextResponse } from "next/server";
import { NotFoundError, SalesError } from "@/lib/henima-sales/types";
import {
  isMissingTrackingTable,
  publicTrackingState,
  recordTrackingPoint,
  TRACKING_KINDS,
  type TrackingKind,
} from "@/lib/henima-tracking/service";

function fail(err: unknown) {
  if (isMissingTrackingTable(err)) {
    return NextResponse.json({ error: "Tabel Henima Tracking belum aktif." }, { status: 503 });
  }
  if (err instanceof NotFoundError || err instanceof SalesError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
  }
  console.error("[henima-tracking]", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Gagal menyimpan lokasi." }, { status: 500 });
}

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    return NextResponse.json(await publicTrackingState(token));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const type = request.headers.get("content-type") || "";
    let kind: TrackingKind;
    let lat: number;
    let lng: number;
    let accuracy: number | null = null;
    let note: string | null = null;
    let photo: { bytes: Uint8Array; mime: string } | null = null;

    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      kind = String(form.get("kind") || "") as TrackingKind;
      lat = Number(form.get("lat"));
      lng = Number(form.get("lng"));
      accuracy = form.get("accuracy") ? Number(form.get("accuracy")) : null;
      note = String(form.get("note") || "") || null;
      const file = form.get("photo");
      if (file instanceof File && file.size > 0) {
        photo = { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || "image/jpeg" };
      }
    } else {
      const body = await request.json();
      kind = String(body.kind || "") as TrackingKind;
      lat = Number(body.lat);
      lng = Number(body.lng);
      accuracy = body.accuracy != null ? Number(body.accuracy) : null;
      note = body.note ? String(body.note) : null;
    }

    if (!TRACKING_KINDS.includes(kind)) {
      return NextResponse.json({ error: "Jenis catatan tidak valid." }, { status: 400 });
    }
    const saved = await recordTrackingPoint(token, { kind, lat, lng, accuracy, note, photo });
    const state = await publicTrackingState(token);
    return NextResponse.json({ ...state, skipped: saved.skipped });
  } catch (err) {
    return fail(err);
  }
}
