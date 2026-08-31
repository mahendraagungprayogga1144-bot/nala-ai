import type { Actor, PaymentMethod } from "./types";
import { SALES_ORDER_SOURCE, SalesError, paymentSplit } from "./types";
import type { SalesDb } from "./db";
import { loadTeamIds } from "./authz";
import { periodRange } from "./dates";
import { listCommissionLedger } from "./commission-service";

export type ReportKind = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";
export type RankMetric = "quantity" | "revenue" | "count";

export type RankRow = {
  salesId: string;
  nama: string;
  role: string;
  qty: number;
  revenue: number;
  count: number;
};

function rankValue(row: RankRow, rankBy: RankMetric) {
  return rankBy === "revenue" ? row.revenue : rankBy === "count" ? row.count : row.qty;
}

/** TOP SALES is team only. Founder closings are "dilayani oleh …", not a ranking. */
export function splitSalesRanking(rows: RankRow[], rankBy: RankMetric = "quantity") {
  const sortRows = (list: RankRow[]) => [...list].sort((a, b) => rankValue(b, rankBy) - rankValue(a, rankBy));
  return {
    ranking: sortRows(rows.filter((r) => r.role === "SALES" || r.role === "LEADER")),
    servedBy: sortRows(rows.filter((r) => r.role === "FOUNDER")),
  };
}

export function servedByLabel(rows: { nama: string }[]) {
  const names = [...new Set(rows.map((r) => r.nama.trim()).filter(Boolean))];
  if (!names.length) return "";
  return `Dilayani oleh ${names.join(", ")}`;
}

function displayCustomerName(raw: string) {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (!t) return "—";
  if (/^(laku|terjual|jual|closing)\b/i.test(t) || t.length > 40) {
    const named = t.match(/\bnama\s+([A-Za-z][A-Za-z'.-]{1,40}(?:\s+[A-Za-z][A-Za-z'.-]{1,20}){0,2})/i);
    if (named) {
      const n = named[1].replace(/\b(tf|trf|qris|cash|tunai|transfer)\b/gi, "").trim();
      if (n.length >= 2) return n;
    }
    return t.slice(0, 22).trim();
  }
  return t;
}

function recapNote(catatan: string | null, products: string) {
  const note = (catatan || "").replace(/\s+/g, " ").trim();
  if (!note) return products;
  if (/^(laku|terjual|jual)\b/i.test(note) || note.length > 48) return products || note.slice(0, 32);
  return note;
}

function hppOf(o: OrderAgg) {
  const header = Number(o.hpp || 0);
  if (header > 0) return header;
  return (o.order_items || []).reduce((s, i) => s + Number(i.hpp || 0) * Number(i.qty || 0), 0);
}

type OrderAgg = {
  id: string;
  sales_id: string | null;
  customer_id: string | null;
  total: number;
  laba: number | null;
  hpp: number | null;
  metode_bayar: string | null;
  payment_status: string | null;
  order_date: string;
  catatan: string | null;
  order_items: { product_id: string | null; qty: number; product_name_snapshot: string | null; harga_jual: number; hpp?: number | null }[];
};

export type RecapLine = {
  date: string;
  customerName: string;
  salesName: string;
  note: string;
  qty: number;
  cash: number;
  transfer: number;
  qris: number;
  cashless: number;
  method: PaymentMethod | string;
  hpp: number;
  profit: number;
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
    .select("id, sales_id, customer_id, total, laba, hpp, metode_bayar, payment_status, order_date, catatan, order_items(product_id, qty, product_name_snapshot, harga_jual, hpp)")
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

  const staffIds = [...new Set(paid.map((o) => o.sales_id).filter(Boolean))] as string[];
  const custIds = [...new Set(paid.map((o) => o.customer_id).filter(Boolean))] as string[];
  const [{ data: staffRows }, { data: custRows }] = await Promise.all([
    staffIds.length
      ? db.from("module_sales_staff").select("id, nama, role").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; nama: string; role: string }[] }),
    custIds.length
      ? db.from("module_crm_customers").select("id, nama").in("id", custIds)
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
  ]);
  const staffMap = Object.fromEntries((staffRows || []).map((s) => [s.id, s]));
  const custMap = Object.fromEntries((custRows || []).map((c) => [c.id, c.nama]));

  const byPay: Record<PaymentMethod, number> = { CASH: 0, TRANSFER: 0, QRIS: 0, OTHER: 0 };
  const byDay: Record<string, number> = {};
  const byDayOmzet: Record<string, { qty: number; cash: number; cashless: number; omzet: number }> = {};
  let cashTotal = 0;
  let transferTotal = 0;
  let qrisTotal = 0;
  let cashlessTotal = 0;
  let hppTotal = 0;
  let profitTotal = 0;

  const lines: RecapLine[] = [...paid]
    .sort((a, b) => a.order_date.localeCompare(b.order_date) || a.id.localeCompare(b.id))
    .map((o) => {
      const total = Number(o.total || 0);
      const customerName = displayCustomerName((o.customer_id && custMap[o.customer_id]) || "");
      const split = paymentSplit(
        o.metode_bayar,
        total,
        `${o.catatan || ""} ${customerName} ${(o.customer_id && custMap[o.customer_id]) || ""}`,
      );
      const hpp = hppOf(o);
      const profit = o.laba != null ? Number(o.laba) : total - hpp;
      const qty = qtyOf(o);
      const products = (o.order_items || []).map((i) => i.product_name_snapshot || "Produk").join(" + ");
      byPay[split.method] += total;
      cashTotal += split.cash;
      transferTotal += split.transfer;
      qrisTotal += split.qris;
      cashlessTotal += split.cashless;
      hppTotal += hpp;
      profitTotal += profit;
      byDay[o.order_date] = (byDay[o.order_date] || 0) + qty;
      const day = byDayOmzet[o.order_date] || { qty: 0, cash: 0, cashless: 0, omzet: 0 };
      day.qty += qty;
      day.cash += split.cash;
      day.cashless += split.cashless;
      day.omzet += total;
      byDayOmzet[o.order_date] = day;
      return {
        date: o.order_date,
        customerName,
        salesName: (o.sales_id && staffMap[o.sales_id]?.nama) || "—",
        note: recapNote(o.catatan, products),
        qty,
        cash: split.cash,
        transfer: split.transfer,
        qris: split.qris,
        cashless: split.cashless,
        method: split.method,
        hpp,
        profit,
      };
    });

  const bySales: Record<string, RankRow> = {};
  for (const o of paid) {
    const id = o.sales_id || "unknown";
    if (!bySales[id]) {
      bySales[id] = {
        salesId: id,
        nama: staffMap[id]?.nama || "—",
        role: staffMap[id]?.role || "",
        qty: 0,
        revenue: 0,
        count: 0,
      };
    }
    bySales[id].qty += qtyOf(o);
    bySales[id].revenue += Number(o.total || 0);
    bySales[id].count += 1;
  }
  const rankBy = opts.rankBy || "quantity";
  const { ranking, servedBy } = splitSalesRanking(Object.values(bySales), rankBy);

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
    servedBy,
    byDay,
    byDayOmzet,
    lines,
    cashTotal,
    transferTotal,
    qrisTotal,
    cashlessTotal,
    hppTotal,
    profitTotal,
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
