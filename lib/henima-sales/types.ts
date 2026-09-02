export const SALES_ORDER_SOURCE = "henima_sales";

export const SALES_ROLES = ["FOUNDER", "LEADER", "SALES"] as const;
export type SalesRole = (typeof SALES_ROLES)[number];

export const CUSTOMER_STATUSES = ["NEW", "ACTIVE", "REPEAT_CUSTOMER", "FOLLOW_UP", "INACTIVE"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "QRIS", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Map kasir/chat variants (tunai, tf, qris, …) onto CASH | TRANSFER | QRIS | OTHER. */
export function normalizePaymentMethod(raw?: string | null): PaymentMethod | null {
  const t = (raw || "")
    .toLowerCase()
    .replace(/[_/,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (t === "qris" || t === "qr" || /\bqris\b/.test(t) || /\bqr\b/.test(t)) return "QRIS";
  if (
    t === "tf" ||
    t === "trf" ||
    t === "transfer" ||
    /\b(transfer|transef|tranfer|trf|tf|bank|wire)\b/.test(t)
  ) {
    return "TRANSFER";
  }
  if (t === "cash" || t === "tunai" || t === "kontan" || /\b(cash|tunai|kontan|efectivo|contado)\b/.test(t)) return "CASH";
  if (t === "other" || t === "lainnya" || t === "lain" || /\b(lainnya|other)\b/.test(t)) return "OTHER";
  return null;
}

export function paymentLabel(method?: string | null) {
  switch (normalizePaymentMethod(method) || (method || "").toUpperCase()) {
    case "TRANSFER":
      return "Transfer";
    case "QRIS":
      return "QRIS";
    case "CASH":
      return "Cash";
    case "OTHER":
      return "Lainnya";
    default:
      return method || "—";
  }
}

export function paymentSplit(methodRaw: string | null | undefined, total: number, hint?: string | null) {
  const amount = Math.round(Number(total) || 0);
  const method = normalizePaymentMethod(methodRaw) || normalizePaymentMethod(hint) || "OTHER";
  return {
    method,
    cash: method === "CASH" ? amount : 0,
    transfer: method === "TRANSFER" ? amount : 0,
    qris: method === "QRIS" ? amount : 0,
    other: method === "OTHER" ? amount : 0,
    cashless: method === "CASH" ? 0 : amount,
  };
}

export const PAYMENT_STATUSES = ["PAID", "PENDING", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FOLLOWUP_STATUSES = [
  "PENDING",
  "CONTACTED",
  "INTERESTED",
  "NO_RESPONSE",
  "REPEAT_ORDER",
  "NOT_INTERESTED",
] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const TARGET_PERIODS = ["daily", "weekly", "monthly"] as const;
export type TargetPeriod = (typeof TARGET_PERIODS)[number];

export const AUDIT_ACTIONS = [
  "CREATE_CUSTOMER",
  "UPDATE_CUSTOMER",
  "CREATE_ORDER",
  "UPDATE_ORDER",
  "DELETE_ORDER",
  "CREATE_FOLLOWUP",
  "UPDATE_FOLLOWUP",
  "CREATE_TESTIMONIAL",
  "CREATE_STUDIO_ASSET",
  "DELETE_STUDIO_ASSET",
  "APPLY_STUDIO_ASSET",
  "UPDATE_TARGET",
  "UPDATE_SETTINGS",
  "UPDATE_COMMISSION",
  "LOGIN",
  "TELEGRAM_LINK",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const TESTIMONIAL_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const TESTIMONIAL_MAX_BYTES = 5 * 1024 * 1024;
export const STUDIO_MIME = TESTIMONIAL_MIME;
export const STUDIO_MAX_BYTES = 8 * 1024 * 1024;

export const SALES_PRODUCT_CATEGORY = "Henima Sales";

export const DEFAULT_HENIMA_PRODUCTS = [
  { name: "Afternoon", unit: "pcs" },
  { name: "The Distance", unit: "pcs" },
] as const;

export const DEFAULT_RETAIL_PRICE = 199999;
export const LEGACY_RETAIL_PRICES = new Set([150000, 199000]);

export function needsRetailSync(name: string, price: number | null | undefined) {
  const n = (name || "").trim().toLowerCase();
  if (!DEFAULT_HENIMA_PRODUCTS.some((d) => d.name.toLowerCase() === n)) return false;
  if (price == null || !(price > 0)) return true;
  return LEGACY_RETAIL_PRICES.has(Math.round(price));
}

/** Persen diskon dari potongan vs subtotal retail (35% untuk 130.000 dari 199.999). */
export function discountPercentOf(retailTotal: number, discount: number) {
  if (!(retailTotal > 0) || !(discount > 0)) return 0;
  const raw = (discount / retailTotal) * 100;
  const nearest = Math.round(raw);
  if (Math.abs(raw - nearest) < 0.05) return nearest;
  return Math.round(raw * 10) / 10;
}

export function formatDiscountPercent(percent: number) {
  if (!(percent > 0)) return "";
  if (Number.isInteger(percent)) return `${percent}%`;
  return `${String(percent).replace(".", ",")}%`;
}

export function isSalesCatalogProduct(p: { name?: string | null; category?: string | null }) {
  const cat = (p.category || "").trim().toLowerCase();
  if (cat === "henima sales" || cat === "parfum") return true;
  const name = (p.name || "").trim().toLowerCase();
  return DEFAULT_HENIMA_PRODUCTS.some((d) => d.name.toLowerCase() === name);
}

export type Actor = {
  staffId: string;
  businessId: string;
  businessName: string;
  ownerUserId: string;
  userId: string | null;
  telegramUserId: number | null;
  role: SalesRole;
  nama: string;
  leaderId: string | null;
  tagline?: string | null;
};

export class SalesError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "SalesError";
  }
}

export class ForbiddenError extends SalesError {
  constructor(message = "Tidak diizinkan.") {
    super(message, "forbidden", 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends SalesError {
  constructor(message = "Data tidak ditemukan.") {
    super(message, "not_found", 404);
    this.name = "NotFoundError";
  }
}

export type CustomerRow = {
  id: string;
  business_id: string;
  user_id: string;
  nama: string;
  telepon: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  alamat: string | null;
  kota: string | null;
  catatan: string | null;
  phone_normalized: string | null;
  assigned_sales_id: string | null;
  status: string | null;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  total_orders: number | null;
  total_items: number | null;
  total_spent: number | null;
  created_at: string;
  updated_at: string | null;
};

export type StaffRow = {
  id: string;
  business_id: string;
  user_id: string | null;
  telegram_user_id: number | null;
  role: SalesRole;
  leader_id: string | null;
  nama: string;
  telepon: string | null;
  invite_code: string | null;
  status: string;
};

export type ProductRow = {
  id: string;
  name: string;
  price: number | null;
  cost: number | null;
  stock: number | null;
  unit: string | null;
};

export type SaleLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type ConfirmSaleInput = {
  customerId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountPercent?: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  orderDate?: string;
  idempotencyKey: string;
  lines?: SaleLine[];
};

export function isRevenueStatus(status: string | null | undefined) {
  return status === "PAID";
}

export function calculateOrderTotal(quantity: number, unitPrice: number, discount: number) {
  if (!(quantity > 0)) throw new SalesError("Jumlah harus lebih dari 0.", "quantity_invalid");
  if (!(unitPrice >= 0) || !Number.isFinite(unitPrice)) {
    throw new SalesError("Harga tidak valid.", "price_invalid");
  }
  if (!(discount >= 0) || !Number.isFinite(discount)) {
    throw new SalesError("Diskon tidak valid.", "discount_invalid");
  }
  const gross = Math.round(quantity * unitPrice);
  const disc = Math.round(discount);
  if (disc > gross) throw new SalesError("Diskon melebihi total.", "discount_invalid");
  return gross - disc;
}

export function calculateLinesTotal(lines: SaleLine[], discount: number) {
  if (!lines.length) throw new SalesError("Produk belum dipilih.", "quantity_invalid");
  let gross = 0;
  for (const line of lines) {
    gross += calculateOrderTotal(line.quantity, line.unitPrice, 0);
  }
  const disc = Math.round(discount);
  if (disc > gross) throw new SalesError("Diskon melebihi total.", "discount_invalid");
  return gross - disc;
}

export function priceAgainstRetail(
  lines: SaleLine[],
  catalog: ProductRow[],
  opts?: { discount?: number | null; discountPercent?: number | null },
): { lines: SaleLine[]; discount: number; discountPercent: number; total: number; retailTotal: number } {
  if (!lines.length) throw new SalesError("Produk belum dipilih.", "quantity_invalid");
  const retailLines = lines.map((line) => {
    const product = catalog.find((p) => p.id === line.productId);
    const retail = product?.price != null && product.price > 0 ? Number(product.price) : line.unitPrice;
    return { ...line, unitPrice: retail };
  });
  const retailTotal = calculateLinesTotal(retailLines, 0);
  const paidTotal = calculateLinesTotal(lines, 0);
  let discount = 0;
  let discountPercent = 0;
  if (opts?.discount != null && opts.discount > 0) {
    discount = Math.round(opts.discount);
    discountPercent = discountPercentOf(retailTotal, discount);
  } else if (opts?.discountPercent != null && opts.discountPercent > 0) {
    discountPercent = opts.discountPercent;
    discount = Math.round(retailTotal * (discountPercent / 100));
  } else if (retailTotal > paidTotal) {
    discount = retailTotal - paidTotal;
    discountPercent = discountPercentOf(retailTotal, discount);
  }
  if (discount > retailTotal) throw new SalesError("Diskon melebihi total.", "discount_invalid");
  const useRetail = discount > 0;
  const gross = useRetail ? retailTotal : paidTotal;
  return {
    lines: useRetail ? retailLines : lines,
    discount,
    discountPercent,
    total: gross - discount,
    retailTotal,
  };
}

export function calculateCommissionAmount(total: number, fixedAmount: number, percentage: number) {
  return Math.round((fixedAmount || 0) + total * ((percentage || 0) / 100));
}

export type CommissionRule = {
  id: string;
  sales_id: string | null;
  role: string | null;
  product_id: string | null;
  fixed_amount: number;
  percentage: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
};

/** Most specific matching rule wins. */
export function pickCommissionRule(
  rules: CommissionRule[],
  opts: { salesId: string; role: string; productId: string; on: string },
): CommissionRule | null {
  const scored = rules
    .filter((r) => {
      if (!r.active) return false;
      if (r.effective_from > opts.on) return false;
      if (r.effective_to && r.effective_to < opts.on) return false;
      if (r.sales_id && r.sales_id !== opts.salesId) return false;
      if (r.role && r.role !== opts.role) return false;
      if (r.product_id && r.product_id !== opts.productId) return false;
      return true;
    })
    .map((r) => ({
      r,
      score:
        (r.sales_id ? 4 : 0) + (r.product_id ? 2 : 0) + (r.role ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.r.effective_from.localeCompare(a.r.effective_from));
  return scored[0]?.r || null;
}
