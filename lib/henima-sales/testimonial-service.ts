import type { Actor } from "./types";
import { ForbiddenError, SalesError, TESTIMONIAL_MAX_BYTES, TESTIMONIAL_MIME } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { wibParts } from "./dates";
import { loadTeamIds } from "./authz";
import { salesLogError } from "./log";

export function testimonialPath(opts: {
  businessId: string;
  customerId: string;
  orderId: string;
  ext: string;
}) {
  const { year, month } = wibParts();
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(opts.ext.toLowerCase()) ? opts.ext.toLowerCase() : "jpg";
  return `${opts.businessId}/testimonials/${year}/${month}/${opts.customerId}/${opts.orderId}/${crypto.randomUUID()}.${safeExt}`;
}

export async function saveTestimonial(
  db: SalesDb,
  actor: Actor,
  opts: {
    customerId: string;
    orderId: string;
    bytes: Uint8Array;
    mime: string;
    caption?: string | null;
    ext: string;
  },
) {
  if (!TESTIMONIAL_MIME.has(opts.mime) && !opts.mime.startsWith("image/")) {
    throw new SalesError("Format foto harus JPG, PNG, atau WEBP.", "file_type");
  }
  if (opts.bytes.byteLength > TESTIMONIAL_MAX_BYTES) {
    throw new SalesError("Ukuran foto terlalu besar (maks 5MB).", "file_size");
  }
  const path = testimonialPath({
    businessId: actor.businessId,
    customerId: opts.customerId,
    orderId: opts.orderId,
    ext: opts.ext,
  });
  const { error: upErr } = await db.storage.from("testimonials").upload(path, opts.bytes, {
    contentType: opts.mime,
    upsert: false,
  });
  if (upErr) {
    salesLogError("testimonial_upload", upErr, { staffId: actor.staffId });
    throw new SalesError("Upload foto gagal. Transaksi tetap bisa dilanjutkan.", "upload_failed", 502);
  }
  const { data, error } = await db
    .from("module_sales_testimonials")
    .insert({
      business_id: actor.businessId,
      customer_id: opts.customerId,
      order_id: opts.orderId,
      sales_id: actor.staffId,
      storage_path: path,
      caption: opts.caption || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal simpan testimoni.", "testimonial_create");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "CREATE_TESTIMONIAL",
    entityType: "testimonial",
    entityId: data.id,
    newValue: { order_id: opts.orderId, path },
  });
  return data;
}

export async function listTestimonials(
  db: SalesDb,
  actor: Actor,
  opts: { salesId?: string; customerId?: string; from?: string; to?: string; page?: number; pageSize?: number },
) {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize || 24));
  const from = (page - 1) * pageSize;
  const teamIds = await loadTeamIds(db, actor);
  let q = db
    .from("module_sales_testimonials")
    .select("*", { count: "exact" })
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (actor.role === "SALES") q = q.eq("sales_id", actor.staffId);
  else if (actor.role === "LEADER") q = q.in("sales_id", [actor.staffId, ...teamIds]);
  if (opts.salesId) {
    if (actor.role === "SALES" && opts.salesId !== actor.staffId) throw new ForbiddenError();
    q = q.eq("sales_id", opts.salesId);
  }
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  if (opts.from) q = q.gte("created_at", opts.from + "T00:00:00+07:00");
  if (opts.to) q = q.lte("created_at", opts.to + "T23:59:59+07:00");
  const { data, error, count } = await q;
  if (error) throw new SalesError(error.message, "testimonial_list");
  return { rows: data || [], total: count || 0, page, pageSize };
}

export async function signedTestimonialUrl(db: SalesDb, path: string) {
  const { data, error } = await db.storage.from("testimonials").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
