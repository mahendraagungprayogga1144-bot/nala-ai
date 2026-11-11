import { todayWib } from "@/lib/date";
import { salesDb, type SalesDb } from "@/lib/henima-sales/db";
import { createCustomer, findCustomerByPhone } from "@/lib/henima-sales/customer-service";
import { confirmSale, listOrders, softDeleteOrder, updateOrder, type SalesOrder } from "@/lib/henima-sales/order-service";
import { listProducts } from "@/lib/henima-sales/staff-service";
import { listCommissionLedger } from "@/lib/henima-sales/commission-service";
import { listHandStock } from "@/lib/henima-sales/hand-stock-service";
import { achievementFor, listTargets } from "@/lib/henima-sales/target-service";
import {
  NotFoundError,
  SalesError,
  SALES_ORDER_SOURCE,
  type Actor,
  type PaymentMethod,
  type PaymentStatus,
  type SalesRole,
} from "@/lib/henima-sales/types";
import { resolveTrackingToken } from "./service";

type StaffRow = {
  id: string;
  nama: string;
  role: string;
  status: string;
  business_id: string;
  user_id: string | null;
  telegram_user_id: number | null;
  leader_id: string | null;
};

export async function actorFromTrackingToken(db: SalesDb, token: string): Promise<Actor> {
  const { link, staff } = await resolveTrackingToken(db, token);
  const { data: full, error } = await db
    .from("module_sales_staff")
    .select("id, nama, role, status, business_id, user_id, telegram_user_id, leader_id")
    .eq("id", staff.id)
    .maybeSingle();
  if (error) throw new SalesError(error.message, "staff_read");
  const row = full as StaffRow | null;
  if (!row || row.status === "disabled") throw new NotFoundError("Link tracking tidak berlaku.");

  const { data: biz } = await db.from("businesses").select("user_id, name").eq("id", link.business_id).maybeSingle();
  if (!biz?.user_id) throw new SalesError("Bisnis tidak ditemukan.", "business_missing", 500);

  return {
    staffId: row.id,
    businessId: link.business_id,
    businessName: biz.name || "HENIMA",
    ownerUserId: biz.user_id,
    userId: row.user_id,
    telegramUserId: row.telegram_user_id,
    role: (row.role as SalesRole) || "SALES",
    nama: row.nama,
    leaderId: row.leader_id,
  };
}

function money(n: number) {
  return Math.round(Number(n) || 0);
}

export async function loadFieldPortal(db: SalesDb, token: string) {
  const actor = await actorFromTrackingToken(db, token);
  const today = todayWib();
  const monthFrom = `${today.slice(0, 8)}01`;
  const [products, todayOrders, monthOrders, targets, monthly, commission, handStock] = await Promise.all([
    listProducts(db, actor.businessId),
    listOrders(db, actor, { from: today, to: today, salesId: actor.staffId, pageSize: 50 }),
    listOrders(db, actor, {
      from: monthFrom,
      to: today,
      salesId: actor.staffId,
      pageSize: 50,
    }),
    listTargets(db, actor, actor.staffId),
    achievementFor(db, actor, "monthly", actor.staffId),
    listCommissionLedger(db, actor, { from: monthFrom, to: today, salesId: actor.staffId }).catch(() => ({
      rows: [],
      total: 0,
    })),
    listHandStock(db, actor, actor.staffId).catch(() => []),
  ]);

  const dayRows = todayOrders.rows || [];
  const omzetHari = dayRows.reduce((s, o) => s + money(o.total), 0);
  const pending = dayRows.filter((o) => o.payment_status === "PENDING");
  const paid = dayRows.filter((o) => o.payment_status === "PAID");
  const setorCash = paid
    .filter((o) => (o.metode_bayar || "").toUpperCase() === "CASH")
    .reduce((s, o) => s + money(o.total), 0);
  const bottles = dayRows.reduce(
    (s, o) => s + (o.order_items || []).reduce((a, i) => a + Number(i.qty || 0), 0),
    0,
  );

  const catalog = products
    .filter((p) => /afternoon|distance/i.test(p.name))
    .map((p) => ({ id: p.id, name: p.name, price: money(p.price ?? 0), stock: p.stock }));
  const fallback = products.slice(0, 4).map((p) => ({ id: p.id, name: p.name, price: money(p.price ?? 0), stock: p.stock }));

  return {
    actor: { staffId: actor.staffId, nama: actor.nama, role: actor.role, businessName: actor.businessName },
    date: today,
    products: catalog.length ? catalog : fallback,
    stats: {
      omzetHari,
      transaksiHari: dayRows.length,
      botolHari: bottles,
      pendingCount: pending.length,
      pendingTotal: pending.reduce((s, o) => s + money(o.total), 0),
      setorCash,
      omzetBulan: money(monthly.omzet),
      targetBulan: monthly.target,
      progressBulan: monthly.achievement,
      terjualBulan: monthly.sold,
      bonusBulan: money(commission.total),
    },
    recent: dayRows.slice(0, 8).map(briefOrder),
    payments: dayRows.map(briefOrder),
    monthOrders: (monthOrders.rows || []).slice(0, 30).map(briefOrder),
    targets: targets.map((t) => ({
      id: t.id,
      period: t.period_type,
      quantity: t.quantity_target,
      revenue: t.revenue_target,
    })),
    monthly,
    handStock: handStock.map((h) => ({
      productId: h.productId,
      productName: h.productName,
      qty: h.qty,
    })),
  };
}

function briefOrder(order: SalesOrder) {
  const first = order.order_items?.[0];
  const items = (order.order_items || [])
    .map((i) => `${i.product_name_snapshot || "Produk"} ×${i.qty}`)
    .join(", ");
  return {
    id: order.id,
    total: money(order.total),
    metode: order.metode_bayar,
    status: order.payment_status,
    catatan: order.catatan,
    orderDate: order.order_date,
    createdAt: order.created_at,
    items,
    productId: first?.product_id || null,
    productName: first?.product_name_snapshot || null,
    quantity: first ? Number(first.qty) : 0,
    unitPrice: first ? money(first.harga_jual) : 0,
  };
}

export async function createFieldSale(
  db: SalesDb,
  token: string,
  input: {
    productId: string;
    quantity: number;
    unitPrice: number;
    customerName: string;
    customerPhone?: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    notes?: string;
    proofPath?: string | null;
    idempotencyKey: string;
  },
) {
  const actor = await actorFromTrackingToken(db, token);
  const nama = input.customerName.trim();
  if (!nama) throw new SalesError("Nama pelanggan wajib.", "customer_name");
  if (!input.productId) throw new SalesError("Pilih produk.", "product_required");
  if (!Number.isFinite(input.quantity) || input.quantity < 1) throw new SalesError("Jumlah botol tidak valid.", "qty");
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new SalesError("Harga tidak valid.", "price");

  let customerId: string;
  const phone = (input.customerPhone || "").trim();
  if (phone) {
    const existing = await findCustomerByPhone(db, actor, phone);
    if (existing) customerId = existing.id;
    else {
      const created = await createCustomer(db, actor, { nama, phone });
      customerId = created.customer.id;
    }
  } else {
    const created = await createCustomer(db, actor, { nama, phone: "" });
    customerId = created.customer.id;
  }

  const products = await listProducts(db, actor.businessId);
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new SalesError("Produk tidak valid.", "product_invalid");

  const noteParts = [input.notes?.trim() || "", input.proofPath ? `bukti:${input.proofPath}` : ""].filter(Boolean);

  const result = await confirmSale(db, actor, {
    customerId,
    productId: product.id,
    productName: product.name,
    quantity: Math.round(input.quantity),
    unitPrice: Math.round(input.unitPrice),
    discount: 0,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    notes: noteParts.join(" · ") || undefined,
    idempotencyKey: input.idempotencyKey,
    orderDate: todayWib(),
  });

  return { order: briefOrder(result.order), duplicate: result.duplicate };
}

export async function markFieldPayment(
  db: SalesDb,
  token: string,
  input: { orderId: string; paymentStatus: PaymentStatus; paymentMethod?: PaymentMethod; notes?: string },
) {
  const actor = await actorFromTrackingToken(db, token);
  const order = await updateOrder(db, actor, input.orderId, {
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
  });
  return { order: briefOrder(order) };
}

export async function updateFieldSale(
  db: SalesDb,
  token: string,
  input: {
    orderId: string;
    productId?: string;
    quantity?: number;
    unitPrice?: number;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    notes?: string | null;
  },
) {
  const actor = await actorFromTrackingToken(db, token);
  if (!input.orderId) throw new SalesError("ID transaksi wajib.", "order_id");

  let productName: string | undefined;
  if (input.productId) {
    const products = await listProducts(db, actor.businessId);
    const product = products.find((p) => p.id === input.productId);
    if (!product) throw new SalesError("Produk tidak valid.", "product_invalid");
    productName = product.name;
  }
  if (input.quantity != null && (!Number.isFinite(input.quantity) || input.quantity < 1)) {
    throw new SalesError("Jumlah botol tidak valid.", "qty");
  }
  if (input.unitPrice != null && (!Number.isFinite(input.unitPrice) || input.unitPrice < 0)) {
    throw new SalesError("Harga tidak valid.", "price");
  }

  const order = await updateOrder(db, actor, input.orderId, {
    productId: input.productId,
    productName,
    quantity: input.quantity != null ? Math.round(input.quantity) : undefined,
    unitPrice: input.unitPrice != null ? Math.round(input.unitPrice) : undefined,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    notes: input.notes,
  });
  return { order: briefOrder(order) };
}

export async function deleteFieldSale(db: SalesDb, token: string, orderId: string) {
  const actor = await actorFromTrackingToken(db, token);
  if (!orderId) throw new SalesError("ID transaksi wajib.", "order_id");
  const result = await softDeleteOrder(db, actor, orderId);
  return { ok: true, result };
}

export function fieldSalesDb() {
  return salesDb();
}

export { SALES_ORDER_SOURCE };
