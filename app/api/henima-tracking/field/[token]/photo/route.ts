import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveTrackingToken } from "@/lib/henima-tracking/service";
import { salesDb } from "@/lib/henima-sales/db";
import { NotFoundError } from "@/lib/henima-sales/types";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const db = salesDb();
    const { link, staff } = await resolveTrackingToken(db, token);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Foto wajib." }, { status: 400 });
    }
    const type = file.type || "image/jpeg";
    if (!ALLOWED.has(type)) {
      return NextResponse.json({ error: "Foto harus JPG, PNG, atau WEBP." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Foto maksimal 5MB." }, { status: 400 });
    }
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${link.business_id}/${staff.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage.from("henima-tracking").upload(path, buffer, {
      contentType: type,
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: "Upload foto gagal. Coba lagi." }, { status: 500 });
    }
    return NextResponse.json({ path });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Link tidak berlaku." }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal upload." }, { status: 500 });
  }
}
