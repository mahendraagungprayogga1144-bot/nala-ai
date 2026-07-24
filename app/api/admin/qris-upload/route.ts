import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertPlatformSettings } from "@/lib/admin/settings";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const MAX_BYTES = 2 * 1024 * 1024;
const BUCKET = "platform-assets";

function extFromType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

function sniffMime(buf: Buffer, name: string): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 6 && buf.slice(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (buf.length >= 6 && buf.slice(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (buf.length >= 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

async function ensureBucket(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.id === BUCKET || b.name === BUCKET)) return;
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  // ignore "already exists"
  if (error && !/exist/i.test(error.message)) throw error;
}

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

  const raw = form.get("file");
  if (!raw || typeof raw === "string") {
    return NextResponse.json({ error: "File QRIS wajib diunggah" }, { status: 400 });
  }

  const blob = raw as Blob & { name?: string };
  const name = typeof blob.name === "string" ? blob.name : "qris.jpg";
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "Maksimal 2 MB" }, { status: 400 });
  }

  let mime = (blob.type || "").toLowerCase();
  if (!ALLOWED.has(mime)) mime = sniffMime(buffer, name);
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Format harus PNG/JPG/WebP/GIF (foto iPhone HEIC belom didukung — export jadi JPG dulu)" },
      { status: 400 },
    );
  }

  const ext = extFromType(mime);
  const path = `qris/merchant.${ext}`;

  let url = "";
  let storageError = "";

  try {
    await ensureBucket(admin);
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: true,
    });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    url = `${pub.publicUrl}?v=${Date.now()}`;
  } catch (e) {
    storageError = e instanceof Error ? e.message : String(e);
    // Fallback: simpan langsung sebagai data URL di settings (tanpa bucket)
    if (buffer.length <= 900_000) {
      url = `data:${mime};base64,${buffer.toString("base64")}`;
    } else {
      return NextResponse.json(
        {
          error: `Upload storage gagal (${storageError}). Coba file lebih kecil (<900KB) atau buat bucket platform-assets di Supabase.`,
        },
        { status: 500 },
      );
    }
  }

  try {
    const settings = await upsertPlatformSettings({ qris_image_url: url }, user.email || "admin");
    await admin.from("admin_logs").insert({
      admin_email: user.email,
      action: "upload_qris",
      detail: { path, url: url.startsWith("data:") ? "data-url" : url, storageError: storageError || null },
    });
    return NextResponse.json({
      url,
      settings,
      warning: storageError ? `Storage gagal, disimpan sebagai data URL: ${storageError}` : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload OK tapi gagal simpan URL" },
      { status: 500 },
    );
  }
}
