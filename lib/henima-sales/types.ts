export const SALES_ORDER_SOURCE = "henima_sales";

export const SALES_ROLES = ["FOUNDER", "LEADER", "SALES"] as const;
export type SalesRole = (typeof SALES_ROLES)[number];

export const CUSTOMER_STATUSES = ["NEW", "ACTIVE", "REPEAT_CUSTOMER", "FOLLOW_UP", "INACTIVE"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "QRIS", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  "UPDATE_TARGET",
  "UPDATE_COMMISSION",
  "LOGIN",
  "TELEGRAM_LINK",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const TESTIMONIAL_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const TESTIMONIAL_MAX_BYTES = 5 * 1024 * 1024;

export const DEFAULT_HENIMA_PRODUCTS = [
  { name: "Afternoon", unit: "pcs" },
  { name: "The Distance", unit: "pcs" },
] as const;

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

export type ConfirmSaleInput = {
  customerId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  orderDate?: string;
  idempotencyKey: string;
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
