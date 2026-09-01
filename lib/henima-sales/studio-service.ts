import type { Actor } from "./types";
import { ForbiddenError, NotFoundError, SalesError, STUDIO_MAX_BYTES, STUDIO_MIME } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { wibParts } from "./dates";
import { salesLogError } from "./log";
import {
  buildBackgroundPrompt,
  resolveStudioFrame,
  resolveStudioPreset,
  studioPresetPublic,
} from "./studio-presets";
import { editStudioPhoto, studioConfigured, studioProvider } from "./studio-provider";

const BUCKET = "henima-studio";
const SIGNED_TTL = 3600;

export type StudioAssetRow = {
  id: string;
  business_id: string;
  sales_id: string | null;
  product_id: string | null;
  product_name: string | null;
  preset: string;
  frame: string;
  prompt: string | null;
  original_path: string;
  result_path: string;
  provider: string | null;
  created_at: string;
};

function extOf(name: string, mime: string) {
  const fromName = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp"].includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function studioPath(opts: { businessId: string; kind: "original" | "result"; ext: string }) {
  const { year, month } = wibParts();
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(opts.ext.toLowerCase()) ? opts.ext.toLowerCase() : "jpg";
  return `${opts.businessId}/studio/${year}/${month}/${opts.kind}-${crypto.randomUUID()}.${safeExt}`;
}

function assertImage(opts: { bytes: Uint8Array; mime: string }) {
  if (!STUDIO_MIME.has(opts.mime) && !opts.mime.startsWith("image/")) {
    throw new SalesError("Format foto harus JPG, PNG, atau WEBP.", "file_type");
  }
  if (opts.bytes.byteLength > STUDIO_MAX_BYTES) {
    throw new SalesError("Ukuran foto terlalu besar (maks 8MB).", "file_size");
  }
  if (opts.bytes.byteLength < 32) {
    throw new SalesError("File foto kosong.", "file_empty");
  }
}

async function uploadBytes(
  db: SalesDb,
  path: string,
  bytes: Uint8Array,
  mime: string,
) {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    salesLogError("studio_upload", error, { path });
    const msg = error.message || "";
    if (/bucket|not found|does not exist/i.test(msg)) {
      throw new SalesError(
        "Bucket henima-studio belum ada. Jalankan migration 20260901_henima_studio di Supabase.",
        "studio_bucket",
        503,
      );
    }
    throw new SalesError("Upload foto studio gagal.", "upload_failed", 502);
  }
}

export async function signedStudioUrl(db: SalesDb, path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error) return null;
  return data.signedUrl;
}

export async function listStudioAssets(
  db: SalesDb,
  actor: Actor,
  opts?: { productId?: string; page?: number; pageSize?: number },
) {
  const page = Math.max(1, opts?.page || 1);
  const pageSize = Math.min(48, Math.max(1, opts?.pageSize || 24));
  let q = db
    .from("module_sales_studio_assets")
    .select("*", { count: "exact" })
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (opts?.productId) q = q.eq("product_id", opts.productId);
  const { data, error, count } = await q;
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      throw new SalesError(
        "Tabel studio belum aktif. Jalankan SQL 20260901_henima_studio di Supabase.",
        "studio_table",
        503,
      );
    }
    throw new SalesError(error.message, "studio_list");
  }
  const rows = (data || []) as StudioAssetRow[];
  const assets = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      originalUrl: await signedStudioUrl(db, row.original_path),
      resultUrl: await signedStudioUrl(db, row.result_path),
    })),
  );
  return {
    configured: studioConfigured(),
    provider: studioProvider(),
    presets: studioPresetPublic(),
    assets,
    total: count || 0,
    page,
    pageSize,
  };
}

export async function createStudioEdit(
  db: SalesDb,
  actor: Actor,
  input: {
    bytes?: Uint8Array;
    mime?: string;
    filename?: string;
    sourceId?: string | null;
    presetRaw?: string | null;
    prompt?: string | null;
    frameRaw?: string | null;
    productId?: string | null;
    productName?: string | null;
  },
) {
  const presetId = resolveStudioPreset(input.presetRaw);
  if (!presetId) throw new SalesError("Pilih latar dulu (Afternoon Gold, Marble, dll).", "studio_preset");
  const frame = resolveStudioFrame(input.frameRaw);
  let prompt: string | null;
  try {
    prompt = buildBackgroundPrompt(presetId, input.prompt);
  } catch (err) {
    throw new SalesError(err instanceof Error ? err.message : "Prompt tidak valid.", "studio_prompt");
  }

  let originalBytes: Uint8Array;
  let originalMime: string;
  let originalFilename: string;
  let existingOriginalPath: string | null = null;
  let productId = input.productId || null;
  let productName = (input.productName || "").trim() || null;

  if (input.sourceId) {
    const { data, error } = await db
      .from("module_sales_studio_assets")
      .select("*")
      .eq("id", input.sourceId)
      .eq("business_id", actor.businessId)
      .maybeSingle();
    if (error || !data) throw new NotFoundError("Foto sumber tidak ditemukan.");
    const src = data as StudioAssetRow;
    const { data: file, error: dlErr } = await db.storage.from(BUCKET).download(src.original_path);
    if (dlErr || !file) throw new SalesError("Gagal membaca foto asli.", "studio_source", 502);
    originalBytes = new Uint8Array(await file.arrayBuffer());
    originalMime = file.type || "image/jpeg";
    originalFilename = src.original_path.split("/").pop() || "original.jpg";
    existingOriginalPath = src.original_path;
    productId = productId || src.product_id;
    productName = productName || src.product_name;
  } else {
    if (!input.bytes || !input.mime) throw new SalesError("Upload foto botol dulu.", "file_required");
    assertImage({ bytes: input.bytes, mime: input.mime });
    originalBytes = input.bytes;
    originalMime = input.mime;
    originalFilename = input.filename || `foto.${extOf("", input.mime)}`;
  }

  const edited = await editStudioPhoto({
    bytes: originalBytes,
    mime: originalMime,
    filename: originalFilename,
    presetId,
    prompt,
    frame,
  });

  const originalPath =
    existingOriginalPath ||
    studioPath({ businessId: actor.businessId, kind: "original", ext: extOf(originalFilename, originalMime) });
  if (!existingOriginalPath) {
    await uploadBytes(db, originalPath, originalBytes, originalMime);
  }
  const resultPath = studioPath({ businessId: actor.businessId, kind: "result", ext: edited.ext });
  await uploadBytes(db, resultPath, edited.bytes, edited.mime);

  const { data, error } = await db
    .from("module_sales_studio_assets")
    .insert({
      business_id: actor.businessId,
      sales_id: actor.staffId,
      product_id: productId,
      product_name: productName,
      preset: presetId,
      frame,
      prompt,
      original_path: originalPath,
      result_path: resultPath,
      provider: edited.provider,
    })
    .select("*")
    .single();
  if (error || !data) {
    salesLogError("studio_insert", error, { staffId: actor.staffId });
    throw new SalesError(error?.message || "Gagal simpan hasil studio.", "studio_create");
  }
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "CREATE_STUDIO_ASSET",
    entityType: "studio",
    entityId: data.id,
    newValue: { preset: presetId, frame, product_id: productId, provider: edited.provider },
  });
  return {
    asset: {
      ...(data as StudioAssetRow),
      originalUrl: await signedStudioUrl(db, originalPath),
      resultUrl: await signedStudioUrl(db, resultPath),
    },
  };
}

export async function applyStudioToProduct(db: SalesDb, actor: Actor, assetId: string, productId: string) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang dapat menempel foto ke katalog.");
  const { data, error } = await db
    .from("module_sales_studio_assets")
    .select("*")
    .eq("id", assetId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (error || !data) throw new NotFoundError("Hasil studio tidak ditemukan.");
  const asset = data as StudioAssetRow;
  const photoUrl = await persistCatalogPhoto(db, actor, asset);
  const { data: product, error: pErr } = await db
    .from("products")
    .select("id, name, photo_url")
    .eq("id", productId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (pErr || !product) throw new NotFoundError("Produk tidak ditemukan.");
  const { error: upErr } = await db
    .from("products")
    .update({ photo_url: photoUrl })
    .eq("id", productId)
    .eq("business_id", actor.businessId);
  if (upErr) throw new SalesError(upErr.message, "studio_apply");
  await db
    .from("module_sales_studio_assets")
    .update({ product_id: String(product.id), product_name: product.name })
    .eq("id", assetId)
    .eq("business_id", actor.businessId);
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "APPLY_STUDIO_ASSET",
    entityType: "studio",
    entityId: assetId,
    oldValue: { photo_url: product.photo_url },
    newValue: { product_id: String(product.id), name: product.name },
  });
  return { ok: true, productId: String(product.id), photoUrl };
}

async function persistCatalogPhoto(db: SalesDb, actor: Actor, asset: StudioAssetRow) {
  const { data: file, error: dlErr } = await db.storage.from(BUCKET).download(asset.result_path);
  if (dlErr || !file) throw new SalesError("Gagal membaca hasil studio.", "studio_source", 502);
  const dest = `${actor.ownerUserId}/studio/${asset.id}.png`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from("product-photos").upload(dest, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (!upErr) {
    const { data: pub } = db.storage.from("product-photos").getPublicUrl(dest);
    if (pub?.publicUrl) return pub.publicUrl;
  }
  const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(asset.result_path, 60 * 60 * 24 * 365);
  if (signed?.signedUrl) return signed.signedUrl;
  throw new SalesError("Gagal menyimpan foto katalog.", "studio_url", 502);
}

export async function deleteStudioAsset(db: SalesDb, actor: Actor, assetId: string) {
  const { data, error } = await db
    .from("module_sales_studio_assets")
    .select("*")
    .eq("id", assetId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (error || !data) throw new NotFoundError("Hasil studio tidak ditemukan.");
  const asset = data as StudioAssetRow;
  if (actor.role === "SALES" && asset.sales_id && asset.sales_id !== actor.staffId) {
    throw new ForbiddenError();
  }
  await db.storage.from(BUCKET).remove([asset.original_path, asset.result_path].filter(Boolean));
  const { error: delErr } = await db
    .from("module_sales_studio_assets")
    .delete()
    .eq("id", assetId)
    .eq("business_id", actor.businessId);
  if (delErr) throw new SalesError(delErr.message, "studio_delete");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "DELETE_STUDIO_ASSET",
    entityType: "studio",
    entityId: assetId,
  });
  return { ok: true };
}

export async function latestStudioOriginal(db: SalesDb, actor: Actor, productHint?: string | null) {
  const { data, error } = await db
    .from("module_sales_studio_assets")
    .select("*")
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new SalesError(error.message, "studio_list");
  const rows = (data || []) as StudioAssetRow[];
  const hint = (productHint || "").trim().toLowerCase();
  if (hint && hint !== "latest" && hint !== "terbaru") {
    const match = rows.find(
      (r) =>
        (r.product_name || "").toLowerCase().includes(hint) ||
        (r.product_id || "") === hint,
    );
    if (match) return match;
  }
  return rows[0] || null;
}
