import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertPlatformSettings } from "@/lib/admin/settings";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("error" in gate && gate.error) return gate.error;
  const { user } = gate;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role tidak tersedia" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form data tidak valid" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File QRIS wajib diunggah" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Format harus PNG/JPG/WebP/GIF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Maksimal 2 MB" }, { status: 400 });
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const path = `qris/merchant.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from("platform-assets").upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json(
      { error: upErr.message || "Gagal upload. Pastikan bucket platform-assets sudah dibuat." },
      { status: 500 },
    );
  }

  const { data: pub } = admin.storage.from("platform-assets").getPublicUrl(path);
  // cache-bust so Upgrade shows the new image immediately
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  try {
    const settings = await upsertPlatformSettings({ qris_image_url: url }, user.email || "admin");
    await admin.from("admin_logs").insert({
      admin_email: user.email,
      action: "upload_qris",
      detail: { path, url },
    });
    return NextResponse.json({ url, settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload OK tapi gagal simpan URL" },
      { status: 500 },
    );
  }
}
