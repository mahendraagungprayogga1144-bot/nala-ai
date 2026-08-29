import { todayWib } from "@/lib/date";
import type { Actor, ConfirmSaleInput, PaymentMethod, PaymentStatus } from "./types";
import { ForbiddenError, NotFoundError, SalesError, SALES_ORDER_SOURCE, calculateOrderTotal } from "./types";
import type { SalesDb } from "./db";
import { rpcMessage } from "./db";
import { writeAudit } from "./audit";
import { assertCanAccessStaff, loadTeamIds } from "./authz";
import { getCustomer } from "./customer-service";
import { listProducts } from "./staff-service";
import { salesLogError } from "./log";

export type SalesOrder = {
  id: string;
  business_id: string;
  customer_id: string | null;
  sales_id: string | null;
  total: number;
  diskon: number | null;
  metode_bayar: string | null;
  payment_status: string | null;
  catatan: string | null;
  order_date: string;
  created_at: string;
  deleted_at: string | null;
  source: string | null;
  order_items?: {
    id: string;
    product_id: string | null;
    qty: number;
    harga_jual: number;
    product_name_snapshot: string | null;
  }[];
};

function assertWritableOrder(actor: Actor, order: SalesOrder, teamIds: string[]) {
  if (!order.sales_id) {
    if (actor.role !== "FOUNDER") throw new ForbiddenError();
    return;
  }
  assertCanAccessStaff(actor, order.sales_id, teamIds);
}

export async function confirmSale(db: SalesDb, actor: Actor, input: ConfirmSaleInput) {
  calculateOrderTotal(input.quantity, input.unitPrice, input.discount);
  await getCustomer(db, actor, input.customerId);
  const products = await listProducts(db, actor.businessId);
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new SalesError("Produk tidak valid.", "product_invalid");

  const { data, error } = await db.rpc("henima_confirm_sale", {
    p_business_id: actor.businessId,
    p_owner_user_id: actor.ownerUserId,
    p_sales_staff_id: actor.staffId,
    p_idempotency_key: input.idempotencyKey,
    p_customer_id: input.customerId,
    p_product_id: input.productId,
    p_product_name: input.productName || product.name,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_discount: input.discount || 0,
    p_payment_method: input.paymentMethod,
    p_payment_status: input.paymentStatus,
    p_notes: input.notes || null,
    p_order_date: input.orderDate || todayWib(),
  });

  if (error) {
    salesLogError("confirm_sale", error, { businessId: actor.businessId, staffId: actor.staffId });
    throw new SalesError(rpcMessage(error), "confirm_failed", 500);
  }

  const result = data as { ok?: boolean; duplicate?: boolean; order_id?: string; total?: number };
  if (!result?.order_id) {
    throw new SalesError(rpcMessage({ message: "empty" }), "confirm_failed", 500);
  }

  if (!result.duplicate) {
    await writeAudit(db, actor, {
      businessId: actor.businessId,
      action: "CREATE_ORDER",
      entityType: "order",
      entityId: result.order_id,
      newValue: {
        product: input.productName,
        quantity: input.quantity,
        total: result.total,
        payment: input.paymentMethod,
        duplicate: false,
      },
    });
  }

  const order = await getOrder(db, actor, result.order_id);
  return { order, duplicate: !!result.duplicate };
}

export async function getOrder(db: SalesDb, actor: Actor, id: string, opts?: { includeDeleted?: boolean }) {
  const { data } = await db
    .from("orders")
    .select("*, order_items(id, product_id, qty, harga_jual, product_name_snapshot)")
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .maybeSingle();
  if (!data) throw new NotFoundError("Transaksi tidak ditemukan.");
  if (data.deleted_at && !opts?.includeDeleted) throw new NotFoundError("Transaksi tidak ditemukan.");
  const teamIds = await loadTeamIds(db, actor);
  assertWritableOrder(actor, data as SalesOrder, teamIds);
  return data as SalesOrder;
}

export async function listOrders(
  db: SalesDb,
  actor: Actor,
  opts: {
    from?: string;
    to?: string;
    salesId?: string;
    productId?: string;
    payment?: string;
    status?: string;
    customerId?: string;
    includeDeleted?: boolean;
    page?: number;
    pageSize?: number;
  },
) {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 20));
  const from = (page - 1) * pageSize;
  const teamIds = await loadTeamIds(db, actor);

  let q = db
    .from("orders")
    .select(
      "id, business_id, customer_id, sales_id, total, diskon, metode_bayar, payment_status, catatan, order_date, created_at, deleted_at, source, order_items(id, product_id, qty, harga_jual, product_name_snapshot)",
      { count: "exact" },
    )
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (!opts.includeDeleted || actor.role !== "FOUNDER") q = q.is("deleted_at", null);
  if (actor.role === "SALES") q = q.eq("sales_id", actor.staffId);
  else if (actor.role === "LEADER") q = q.in("sales_id", [actor.staffId, ...teamIds]);
  if (opts.salesId) {
    assertCanAccessStaff(actor, opts.salesId, teamIds);
    q = q.eq("sales_id", opts.salesId);
  }
  if (opts.from) q = q.gte("order_date", opts.from);
  if (opts.to) q = q.lte("order_date", opts.to);
  if (opts.payment) q = q.eq("metode_bayar", opts.payment);
  if (opts.status) q = q.eq("payment_status", opts.status);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);

  const { data, error, count } = await q;
  if (error) throw new SalesError(error.message, "order_list");

  let rows = (data || []) as SalesOrder[];
  if (opts.productId) {
    rows = rows.filter((o) => o.order_items?.some((i) => i.product_id === opts.productId));
  }
  return { rows, total: count || 0, page, pageSize };
}

export async function updateOrder(
  db: SalesDb,
  actor: Actor,
  id: string,
  patch: Partial<{
    quantity: number;
    unitPrice: number;
    discount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    notes: string | null;
    productId: string;
    productName: string;
  }>,
) {
  const current = await getOrder(db, actor, id);
  if (current.deleted_at) throw new SalesError("Transaksi sudah dihapus.", "deleted");

  // Structural qty/product/price changes: reverse + re-confirm with same id is unsafe.
  // Keep metadata edits in place; for qty/price recreate via delete+new is worse.
  // We update line + totals, then adjust stock delta.
  const item = current.order_items?.[0];
  if (!item) throw new SalesError("Item transaksi tidak ditemukan.", "no_item");

  const qty = patch.quantity ?? Number(item.qty);
  const price = patch.unitPrice ?? Number(item.harga_jual);
  const discount = patch.discount ?? Number(current.diskon || 0);
  const total = calculateOrderTotal(qty, price, discount);
  const productId = patch.productId ?? item.product_id ?? "";
  const productName = patch.productName ?? item.product_name_snapshot ?? "";

  const qtyDelta = qty - Number(item.qty);
  if (qtyDelta !== 0 && item.product_id) {
    const { data: prod } = await db.from("products").select("id, stock").eq("id", item.product_id).maybeSingle();
    if (prod) {
      const next = Number(prod.stock || 0) - qtyDelta;
      if (next < 0) throw new SalesError("Stok tidak cukup untuk perubahan ini.", "stock_insufficient");
      await db.from("products").update({ stock: next }).eq("id", prod.id);
    }
  }

  const { error: itemErr } = await db
    .from("order_items")
    .update({
      qty,
      harga_jual: price,
      product_id: productId,
      product_name_snapshot: productName,
      laba: (price - 0) * qty,
    })
    .eq("id", item.id);
  if (itemErr) throw new SalesError(itemErr.message, "order_update");

  const { data, error } = await db
    .from("orders")
    .update({
      total,
      diskon: discount,
      metode_bayar: patch.paymentMethod ?? current.metode_bayar,
      payment_status: patch.paymentStatus ?? current.payment_status,
      catatan: patch.notes !== undefined ? patch.notes : current.catatan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal mengubah transaksi.", "order_update");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_ORDER",
    entityType: "order",
    entityId: id,
    oldValue: { total: current.total, qty: item.qty },
    newValue: { total, qty },
  });
  return getOrder(db, actor, id);
}

export async function softDeleteOrder(db: SalesDb, actor: Actor, id: string) {
  await getOrder(db, actor, id);
  const { data, error } = await db.rpc("henima_soft_delete_sale", {
    p_order_id: id,
    p_business_id: actor.businessId,
  });
  if (error) {
    salesLogError("delete_sale", error, { orderId: id });
    throw new SalesError(rpcMessage(error), "delete_failed", 500);
  }
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "DELETE_ORDER",
    entityType: "order",
    entityId: id,
    newValue: data,
  });
  return data as { ok?: boolean; already_deleted?: boolean };
}
