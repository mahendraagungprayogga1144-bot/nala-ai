import { NextResponse } from "next/server";
import { withSalesActor } from "@/lib/henima-sales/http";
import { loadQrisUrl, qrisStoragePath } from "@/lib/henima-tracking/service";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function GET() {
  return withSalesActor(async ({ actor, db }) => {
    const url = await loadQrisUrl(db, actor.businessId);
    return { qrisUrl: url };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Kirim file gambar QRIS." }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Gambar QRIS wajib." }, { status: 400 });
    const type = file.type || "image/jpeg";
    if (!ALLOWED.has(type)) {
      return NextResponse.json({ error: "QRIS harus JPG, PNG, atau WEBP." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Gambar maksimal 5MB." }, { status: 400 });
    }
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = qrisStoragePath(actor.businessId, ext);
    const buffer = Buffer.from(await file.arrayBuffer());
    // Hapus versi lama supaya hanya satu QRIS aktif.
    await db.storage.from("henima-tracking").remove([
      qrisStoragePath(actor.businessId, "jpg"),
      qrisStoragePath(actor.businessId, "png"),
      qrisStoragePath(actor.businessId, "webp"),
    ]);
    const { error } = await db.storage.from("henima-tracking").upload(path, buffer, {
      contentType: type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg",
      upsert: true,
    });
    if (error) return NextResponse.json({ error: "Upload QRIS gagal." }, { status: 500 });
    const qrisUrl = await loadQrisUrl(db, actor.businessId);
    return { qrisUrl, path };
  });
}

export async function DELETE() {
  return withSalesActor(async ({ actor, db }) => {
    await db.storage.from("henima-tracking").remove([
      qrisStoragePath(actor.businessId, "jpg"),
      qrisStoragePath(actor.businessId, "png"),
      qrisStoragePath(actor.businessId, "webp"),
    ]);
    return { ok: true };
  });
}
