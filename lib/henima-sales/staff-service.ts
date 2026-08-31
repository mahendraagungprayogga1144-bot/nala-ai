import { randomBytes } from "crypto";
import type { Actor, SalesRole, StaffRow } from "./types";
import { ForbiddenError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { DEFAULT_HENIMA_PRODUCTS, SALES_PRODUCT_CATEGORY, isSalesCatalogProduct } from "./types";

export function newInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function listStaff(db: SalesDb, actor: Actor) {
  if (actor.role === "SALES") {
    const { data } = await db.from("module_sales_staff").select("*").eq("id", actor.staffId).maybeSingle();
    return data ? [data as StaffRow] : [];
  }
  let q = db
    .from("module_sales_staff")
    .select("*")
    .eq("business_id", actor.businessId)
    .order("nama");
  if (actor.role === "LEADER") {
    q = q.or(`id.eq.${actor.staffId},leader_id.eq.${actor.staffId}`);
  }
  const { data, error } = await q;
  if (error) throw new SalesError(error.message, "staff_list");
  return (data || []) as StaffRow[];
}

export async function createStaff(
  db: SalesDb,
  actor: Actor,
  input: { nama: string; role: SalesRole; leaderId?: string | null; telepon?: string | null },
) {
  if (actor.role === "SALES") throw new ForbiddenError();
  if (input.role === "FOUNDER" && actor.role !== "FOUNDER") throw new ForbiddenError();
  if (actor.role === "LEADER" && input.role !== "SALES") throw new ForbiddenError();

  const leaderId = input.role === "SALES" ? input.leaderId || (actor.role === "LEADER" ? actor.staffId : null) : null;
  const { data, error } = await db
    .from("module_sales_staff")
    .insert({
      business_id: actor.businessId,
      nama: input.nama.trim(),
      role: input.role,
      leader_id: leaderId,
      telepon: input.telepon || null,
      invite_code: newInviteCode(),
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal menambah sales.", "staff_create");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "TELEGRAM_LINK",
    entityType: "staff",
    entityId: data.id,
    newValue: { nama: data.nama, role: data.role, invite_code: data.invite_code },
  });
  return data as StaffRow;
}

export async function rotateInvite(db: SalesDb, actor: Actor, staffId: string) {
  if (actor.role === "SALES" && staffId !== actor.staffId) throw new ForbiddenError();
  const code = newInviteCode();
  const { data, error } = await db
    .from("module_sales_staff")
    .update({ invite_code: code, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("business_id", actor.businessId)
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal membuat kode.", "invite");
  return data as StaffRow;
}

export async function ensureDefaultProducts(db: SalesDb, actor: Actor) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError();
  const { data: existing } = await db
    .from("products")
    .select("id, name")
    .eq("business_id", actor.businessId);
  const names = new Set((existing || []).map((p: { name: string }) => p.name.toLowerCase()));
  const toInsert = DEFAULT_HENIMA_PRODUCTS.filter((p) => !names.has(p.name.toLowerCase()));
  const rows = toInsert.map((p) => ({
    user_id: actor.ownerUserId,
    business_id: actor.businessId,
    name: p.name,
    unit: p.unit,
    stock: 0,
    min_stock: 0,
    category: SALES_PRODUCT_CATEGORY,
  }));
  if (toInsert.length) {
    const { error } = await db.from("products").insert(rows);
    if (error) throw new SalesError(error.message, "product_seed");
  }
  invalidateProductCache(actor.businessId);
  await db
    .from("products")
    .update({ category: SALES_PRODUCT_CATEGORY })
    .eq("business_id", actor.businessId)
    .in(
      "name",
      DEFAULT_HENIMA_PRODUCTS.map((p) => p.name),
    );
  return listProducts(db, actor.businessId);
}

export async function upsertSalesProduct(
  db: SalesDb,
  actor: Actor,
  input: { id?: string | null; name: string; price: number; stock?: number; unit?: string | null },
) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang dapat mengatur produk modul ini.");
  const name = input.name.trim();
  if (name.length < 1) throw new SalesError("Nama produk wajib.", "product_name");
  if (!Number.isFinite(input.price) || input.price < 0) throw new SalesError("Harga tidak valid.", "product_price");
  const stock = Number.isFinite(input.stock) ? Number(input.stock) : 0;
  const unit = (input.unit || "pcs").trim() || "pcs";

  if (input.id) {
    const { data, error } = await db
      .from("products")
      .update({
        name,
        price: input.price,
        stock,
        unit,
        category: SALES_PRODUCT_CATEGORY,
      })
      .eq("id", input.id)
      .eq("business_id", actor.businessId)
      .select("id, name, price, cost, stock, unit")
      .single();
    if (error || !data) throw new SalesError(error?.message || "Gagal update produk.", "product_update");
    invalidateProductCache(actor.businessId);
    return {
      id: String(data.id),
      name: data.name as string,
      price: data.price == null ? null : Number(data.price),
      cost: data.cost == null ? null : Number(data.cost),
      stock: data.stock == null ? null : Number(data.stock),
      unit: data.unit as string | null,
    };
  }

  const { data, error } = await db
    .from("products")
    .insert({
      user_id: actor.ownerUserId,
      business_id: actor.businessId,
      name,
      price: input.price,
      stock,
      min_stock: 0,
      unit,
      category: SALES_PRODUCT_CATEGORY,
    })
    .select("id, name, price, cost, stock, unit")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal tambah produk.", "product_create");
  invalidateProductCache(actor.businessId);
  return {
    id: String(data.id),
    name: data.name as string,
    price: data.price == null ? null : Number(data.price),
    cost: data.cost == null ? null : Number(data.cost),
    stock: data.stock == null ? null : Number(data.stock),
    unit: data.unit as string | null,
  };
}

export async function setStaffStatus(db: SalesDb, actor: Actor, staffId: string, status: "active" | "disabled") {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang dapat mengubah status tim.");
  if (staffId === actor.staffId) throw new SalesError("Tidak dapat menonaktifkan akun sendiri.", "self_disable");
  const { data, error } = await db
    .from("module_sales_staff")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("business_id", actor.businessId)
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal ubah status.", "staff_status");
  return data as StaffRow;
}

const PRODUCT_TTL_MS = 30_000;
const productCache = new Map<string, { at: number; value: ReturnType<typeof mapProductRows> }>();

function mapProductRows(
  data: {
    id: unknown;
    name: string | null;
    price: unknown;
    cost: unknown;
    stock: unknown;
    unit: string | null;
    category?: string | null;
  }[],
) {
  return data.filter(isSalesCatalogProduct).map((p) => ({
    id: String(p.id),
    name: p.name as string,
    price: p.price == null ? null : Number(p.price),
    cost: p.cost == null ? null : Number(p.cost),
    stock: p.stock == null ? null : Number(p.stock),
    unit: p.unit as string | null,
  }));
}

export function invalidateProductCache(businessId?: string) {
  if (businessId) productCache.delete(businessId);
  else productCache.clear();
}

export async function listProducts(db: SalesDb, businessId: string) {
  const hit = productCache.get(businessId);
  if (hit && Date.now() - hit.at < PRODUCT_TTL_MS) return hit.value;
  const { data, error } = await db
    .from("products")
    .select("id, name, price, cost, stock, unit, category")
    .eq("business_id", businessId)
    .order("name");
  if (error) throw new SalesError(error.message, "product_list");
  const value = mapProductRows((data || []) as Parameters<typeof mapProductRows>[0]);
  productCache.set(businessId, { at: Date.now(), value });
  return value;
}
