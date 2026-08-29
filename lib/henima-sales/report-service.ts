import type { Actor } from "./types";
import { SALES_ORDER_SOURCE, SalesError } from "./types";
import type { SalesDb } from "./db";
import { loadTeamIds } from "./authz";
import { periodRange } from "./dates";
import { listCommissionLedger } from "./commission-service";

export type ReportKind = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";
export type RankMetric = "quantity" | "revenue" | "count";

type OrderAgg = {
  id: string;
  sales_id: string | null;
  customer_id: string | null;
  total: number;
  metode_bayar: string | null;
  payment_status: string | null;
  order_date: string;
  order_items: { product_id: string | null; qty: number; product_name_snapshot: string | null; harga_jual: number }[];
};

export async function buildSalesReport(
  db: SalesDb,
  actor: Actor,
  opts: {
    kind: ReportKind;
    from?: string;
    to?: string;
    salesId?: string;
    productId?: string;
    payment?: string;
    rankBy?: RankMetric;
  },
) {
  const range = periodRange(opts.kind, { from: opts.from, to: opts.to });
  const teamIds = await loadTeamIds(db, actor);

  let q = db
    .from("orders")
    .select("id, sales_id, customer_id, total, metode_bayar, payment_status, order_date, order_items(product_id, qty, product_name_snapshot, harga_jual)")
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null)
    .gte("order_date", range.from)
    .lte("order_date", range.to);

  if (actor.role === "SALES") q = q.eq("sales_id", actor.staffId);
  else if (actor.role === "LEADER") q = q.in("sales_id", [actor.staffId, ...teamIds]);
  if (opts.salesId) q = q.eq("sales_id", opts.salesId);
  if (opts.payment) q = q.eq("metode_bayar", opts.payment);

  const { data, error } = await q;
  if (error) throw new SalesError(error.message, "report");

  let orders = (data || []) as OrderAgg[];
  if (opts.productId) {
    orders = orders.filter((o) => o.order_items?.some((i) => i.product_id === opts.productId));
  }

  const paid = orders.filter((o) => o.payment_status === "PAID");
  const qtyOf = (o: OrderAgg) => (o.order_items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
  const totalQty = paid.reduce((s, o) => s + qtyOf(o), 0);
  const totalRevenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const aov = paid.length ? Math.round(totalRevenue / paid.length) : 0;

  const byProduct: Record<string, { name: string; qty: number; omzet: number }> = {};
  for (const o of paid) {
    for (const i of o.order_items || []) {
      const name = i.product_name_snapshot || i.product_id || "Produk";
      const key = i.product_id || name;
      if (!byProduct[key]) byProduct[key] = { name, qty: 0, omzet: 0 };
      byProduct[key].qty += Number(i.qty || 0);
      byProduct[key].omzet += Number(i.qty || 0) * Number(i.harga_jual || 0);
    }
  }

  const byPay: Record<string, number> = { CASH: 0, TRANSFER: 0, QRIS: 0, OTHER: 0 };
  for (const o of paid) {
    const m = (o.metode_bayar || "OTHER").toUpperCase();
    byPay[m] = (byPay[m] || 0) + Number(o.total || 0);
  }

  const staffIds = [...new Set(paid.map((o) => o.sales_id).filter(Boolean))] as string[];
  const { data: staffRows } = staffIds.length
    ? await db.from("module_sales_staff").select("id, nama, role").in("id", staffIds)
    : { data: [] as { id: string; nama: string; role: string }[] };
  const staffMap = Object.fromEntries((staffRows || []).map((s) => [s.id, s]));

  const bySales: Record<string, { salesId: string; nama: string; qty: number; revenue: number; count: number }> = {};
  for (const o of paid) {
    const id = o.sales_id || "unknown";
    if (!bySales[id]) {
      bySales[id] = { salesId: id, nama: staffMap[id]?.nama || "—", qty: 0, revenue: 0, count: 0 };
    }
    bySales[id].qty += qtyOf(o);
    bySales[id].revenue += Number(o.total || 0);
    bySales[id].count += 1;
  }
  const rankBy = opts.rankBy || "quantity";
  const rankValue = (row: { qty: number; revenue: number; count: number }) =>
    rankBy === "revenue" ? row.revenue : rankBy === "count" ? row.count : row.qty;
  const ranking = Object.values(bySales).sort((a, b) => rankValue(b) - rankValue(a));

  const byDay: Record<string, number> = {};
  for (const o of paid) {
    byDay[o.order_date] = (byDay[o.order_date] || 0) + qtyOf(o);
  }

  const customerIds = [...new Set(paid.map((o) => o.customer_id).filter(Boolean))] as string[];
  let newCustomers = 0;
  let repeatCustomers = 0;
  if (customerIds.length) {
    const { data: custs } = await db
      .from("module_crm_customers")
      .select("id, first_purchase_at, total_orders")
      .in("id", customerIds);
    for (const c of custs || []) {
      if (c.first_purchase_at && c.first_purchase_at >= range.from && c.first_purchase_at <= range.to) {
        newCustomers += 1;
      }
      if (Number(c.total_orders || 0) >= 2) repeatCustomers += 1;
    }
  }

  const { data: followRows } = await db
    .from("module_sales_follow_ups")
    .select("status")
    .eq("business_id", actor.businessId)
    .gte("scheduled_at", range.from)
    .lte("scheduled_at", range.to);
  const followSummary: Record<string, number> = {};
  for (const f of followRows || []) {
    followSummary[f.status] = (followSummary[f.status] || 0) + 1;
  }

  const { count: testimonialCount } = await db
    .from("module_sales_testimonials")
    .select("id", { count: "exact", head: true })
    .eq("business_id", actor.businessId)
    .gte("created_at", range.from + "T00:00:00+07:00")
    .lte("created_at", range.to + "T23:59:59+07:00");

  const commission = await listCommissionLedger(db, actor, { from: range.from, to: range.to, salesId: opts.salesId });

  return {
    range,
    totalOrders: paid.length,
    pendingOrders: orders.filter((o) => o.payment_status === "PENDING").length,
    cancelledOrders: orders.filter((o) => o.payment_status === "CANCELLED").length,
    totalQty,
    totalRevenue,
    aov,
    byProduct: Object.values(byProduct).sort((a, b) => b.qty - a.qty),
    byPay,
    ranking,
    byDay,
    newCustomers,
    repeatCustomers,
    followSummary,
    testimonialCount: testimonialCount || 0,
    totalCommission: commission.total,
    commissionByRole: {
      SALES: commission.rows
        .filter((r: { role: string }) => r.role === "SALES")
        .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0),
      LEADER: commission.rows
        .filter((r: { role: string }) => r.role === "LEADER")
        .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0),
    },
  };
}

export type SalesReport = Awaited<ReturnType<typeof buildSalesReport>>;
