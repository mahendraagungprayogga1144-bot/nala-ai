import type { SupabaseClient } from "@supabase/supabase-js";
import { todayWib } from "@/lib/date";
import { wibDayWindow } from "@/lib/henima-tracking/shared";
export type OfficeOrderRow = {
  total: number;
  source: string | null;
  sales_id: string | null;
};

export type OfficeStaffRow = {
  id: string;
  nama: string;
  role: string;
};

export type OfficePointRow = {
  staff_id: string;
  kind: string;
  lat: number;
  lng: number;
  late: boolean;
  note: string | null;
  recorded_at: string;
};

export type OfficeProductRow = {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  unit: string | null;
};

export type OfficeSlice<T> = {
  ok: boolean;
  notice: string | null;
  rows: T;
};

export type OfficeFacts = {
  businessId: string;
  orders: OfficeSlice<OfficeOrderRow[]>;
  pemasukan: OfficeSlice<number>;
  staff: OfficeSlice<OfficeStaffRow[]>;
  points: OfficeSlice<OfficePointRow[]>;
  products: OfficeSlice<OfficeProductRow[]>;
};

export type StockAdjustInput = {
  businessId: string;
  userId: string;
  productId: string;
  direction: "masuk" | "keluar";
  quantity: number;
};

export type StockAdjustResult =
  | { ok: true; name: string; before: number; after: number; direction: "masuk" | "keluar"; quantity: number }
  | { ok: false; message: string };

const PRODUCT_CAP = 400;
const ORDER_CAP = 1000;

function missingTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = `${error.message || ""} ${error.code || ""}`.toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache") || error.code === "42P01" || error.code === "PGRST205";
}

function sliceError<T>(empty: T, error: { message?: string } | null, label: string): OfficeSlice<T> {
  if (missingTable(error)) {
    return { ok: false, notice: `${label} belum tersedia di bisnis ini.`, rows: empty };
  }
  return { ok: false, notice: `${label} belum bisa dibaca. Coba muat ulang.`, rows: empty };
}

export type OfficeRepository = {
  loadFacts(db: SupabaseClient, businessId: string): Promise<OfficeFacts>;
  adjustStock(db: SupabaseClient, input: StockAdjustInput): Promise<StockAdjustResult>;
};

async function loadOrders(db: SupabaseClient, businessId: string): Promise<OfficeSlice<OfficeOrderRow[]>> {
  const today = todayWib();
  const first = await db
    .from("orders")
    .select("total, source, sales_id")
    .eq("business_id", businessId)
    .eq("order_date", today)
    .is("deleted_at", null)
    .limit(ORDER_CAP);
  const query = first.error?.message?.toLowerCase().includes("deleted_at")
    ? await db.from("orders").select("total, source, sales_id").eq("business_id", businessId).eq("order_date", today).limit(ORDER_CAP)
    : first;
  if (query.error) return sliceError([], query.error, "Order hari ini");
  return {
    ok: true,
    notice: null,
    rows: (query.data || []).map((row) => ({
      total: Number(row.total) || 0,
      source: row.source ? String(row.source) : null,
      sales_id: row.sales_id ? String(row.sales_id) : null,
    })),
  };
}

async function loadPemasukan(db: SupabaseClient, businessId: string): Promise<OfficeSlice<number>> {
  const today = todayWib();
  const { data, error } = await db
    .from("transactions")
    .select("amount")
    .eq("business_id", businessId)
    .eq("type", "pemasukan")
    .eq("transaction_date", today)
    .limit(ORDER_CAP);
  if (error) return sliceError(0, error, "Pemasukan kasir");
  const sum = (data || []).reduce((total, row) => total + (Number(row.amount) || 0), 0);
  return { ok: true, notice: null, rows: sum };
}

async function loadStaff(db: SupabaseClient, businessId: string): Promise<OfficeSlice<OfficeStaffRow[]>> {
  const { data, error } = await db
    .from("module_sales_staff")
    .select("id, nama, role, status")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("nama");
  if (error) return sliceError([], error, "Daftar sales");
  return {
    ok: true,
    notice: null,
    rows: (data || []).map((row) => ({
      id: String(row.id),
      nama: String(row.nama || "Sales"),
      role: String(row.role || ""),
    })),
  };
}

async function loadPoints(
  db: SupabaseClient,
  staffIds: string[],
): Promise<OfficeSlice<OfficePointRow[]>> {
  if (!staffIds.length) return { ok: true, notice: null, rows: [] };
  const win = wibDayWindow();
  const { data, error } = await db
    .from("module_henima_tracking_points")
    .select("staff_id, kind, lat, lng, late, note, recorded_at")
    .in("staff_id", staffIds)
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to)
    .order("recorded_at", { ascending: false })
    .limit(300);
  if (error) return sliceError([], error, "Tracking hari ini");
  return {
    ok: true,
    notice: null,
    rows: (data || []).map((row) => ({
      staff_id: String(row.staff_id),
      kind: String(row.kind || ""),
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
      late: Boolean(row.late),
      note: row.note ? String(row.note) : null,
      recorded_at: String(row.recorded_at),
    })),
  };
}

async function loadProducts(db: SupabaseClient, businessId: string): Promise<OfficeSlice<OfficeProductRow[]>> {
  const first = await db
    .from("products")
    .select("id, name, stock, min_stock, unit")
    .eq("business_id", businessId)
    .order("name")
    .limit(PRODUCT_CAP);
  const query = first.error?.message?.toLowerCase().includes("unit")
    ? await db.from("products").select("id, name, stock, min_stock").eq("business_id", businessId).order("name").limit(PRODUCT_CAP)
    : first;
  if (query.error) return sliceError([], query.error, "Stok produk");
  return {
    ok: true,
    notice: null,
    rows: (query.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || "Produk"),
      stock: Number(row.stock) || 0,
      min_stock: Number(row.min_stock) || 0,
      unit: "unit" in row && row.unit ? String(row.unit) : null,
    })),
  };
}

export const officeRepository: OfficeRepository = {
  async loadFacts(db, businessId) {
    const [orders, pemasukan, staff, products] = await Promise.all([
      loadOrders(db, businessId),
      loadPemasukan(db, businessId),
      loadStaff(db, businessId),
      loadProducts(db, businessId),
    ]);
    const points = staff.ok
      ? await loadPoints(db, staff.rows.map((row) => row.id))
      : { ok: false, notice: null, rows: [] as OfficePointRow[] };
    return { businessId, orders, pemasukan, staff, points, products };
  },

  async adjustStock(db, input) {
    const qty = input.quantity;
    if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) {
      return { ok: false, message: "Jumlah harus bilangan bulat, lebih dari 0, paling banyak 100.000." };
    }

    const { data: product, error: readError } = await db
      .from("products")
      .select("id, name, stock")
      .eq("id", input.productId)
      .eq("business_id", input.businessId)
      .maybeSingle();
    if (readError || !product) {
      return { ok: false, message: "Produk itu tidak ada di inventory bisnis ini." };
    }

    const before = Number(product.stock) || 0;
    const after = input.direction === "masuk" ? before + qty : before - qty;
    if (after < 0) {
      return { ok: false, message: `Stok ${product.name} tinggal ${before}. Tidak cukup dikurangi ${qty}.` };
    }

    const { data: updated, error: stockError } = await db
      .from("products")
      .update({ stock: after })
      .eq("id", product.id)
      .eq("business_id", input.businessId)
      .eq("stock", before)
      .select("id")
      .maybeSingle();
    if (stockError || !updated) {
      return { ok: false, message: "Stok baru saja berubah. Muat ulang, lalu coba lagi." };
    }

    const { error: moveError } = await db.from("stock_movements").insert({
      user_id: input.userId,
      product_id: product.id,
      type: input.direction,
      reason: input.direction === "keluar" ? "koreksi" : null,
      quantity: qty,
      note: "Koreksi dari Kantor AI",
      profit_loss: 0,
      movement_date: todayWib(),
    });
    if (moveError) {
      await db.from("products").update({ stock: before }).eq("id", product.id).eq("business_id", input.businessId).eq("stock", after);
      return { ok: false, message: "Pergerakan stok gagal dicatat. Stok dikembalikan." };
    }

    return {
      ok: true,
      name: String(product.name),
      before,
      after,
      direction: input.direction,
      quantity: qty,
    };
  },
};
