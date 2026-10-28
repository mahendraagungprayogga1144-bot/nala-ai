import { createClient } from "@/lib/supabase/server";
import { loadTeamIds, resolveActorByUserId } from "@/lib/henima-sales/authz";
import { salesDb } from "@/lib/henima-sales/db";
import { loadCatalogCosts, orderHppTotal } from "@/lib/henima-sales/hpp";
import { cleanProductLabel } from "@/lib/henima-sales/labels";
import { fmtRp } from "@/lib/henima-sales/money";
import { companyPnl, reportScope, servedByLabel, splitSalesRanking, type RankRow } from "@/lib/henima-sales/report-service";
import { listExpenses } from "@/lib/henima-sales/expense-service";
import { achievementFor } from "@/lib/henima-sales/target-service";
import { SALES_ORDER_SOURCE, paymentSplit, type Actor } from "@/lib/henima-sales/types";
import type { OfficeProductRow } from "./repository";

export type CompanyWindow = { from: string; to: string; label: string };

export type SoldProduct = { name: string; qty: number; omzet: number };

export type CompanyParty = { name: string; total: number; items: string };

export type CompanyBrief = {
  ok: true;
  label: string;
  book: string;
  applyOpex: boolean;
  omzet: number;
  hpp: number;
  opex: number;
  labaKotor: number;
  labaBersih: number;
  paidCount: number;
  pendingCount: number;
  qty: number;
  products: SoldProduct[];
  unpaid: CompanyParty[];
  customers: CompanyParty[];
  ranking: { nama: string; qty: number; omzet: number }[];
  servedBy: string;
  cash: number;
  transfer: number;
  qris: number;
  target: { sold: number; goal: number; remaining: number; pct: number; omzet: number } | null;
  followUps: { customer: string; note: string | null }[];
  expenseNote: string | null;
};

type OrderItem = {
  product_id: string | null;
  qty: number;
  product_name_snapshot: string | null;
  harga_jual: number;
  hpp?: number | null;
};

type OrderRow = {
  id: string;
  sales_id: string | null;
  customer_id: string | null;
  total: number;
  hpp: number | null;
  metode_bayar: string | null;
  payment_status: string | null;
  catatan: string | null;
  order_items: OrderItem[] | null;
};

function itemLabel(items: OrderItem[] | null) {
  const parts = (items || [])
    .map((item) => {
      const name = cleanProductLabel(item.product_name_snapshot || "Produk");
      const qty = Number(item.qty || 0);
      return qty > 1 ? `${name} × ${qty}` : name;
    })
    .filter(Boolean);
  return parts.join(", ") || "tanpa rincian barang";
}

function moneyLine(brief: CompanyBrief) {
  const head = `Omzet ${fmtRp(brief.omzet)}. HPP ${fmtRp(brief.hpp)}. Laba kotor ${fmtRp(brief.labaKotor)}.`;
  if (brief.expenseNote) return `${head} ${brief.expenseNote}`;
  if (!brief.applyOpex) return head;
  return `${head} Biaya operasional ${fmtRp(brief.opex)}. Laba bersih ${fmtRp(brief.labaBersih)}.`;
}

export function formatCompanyReport(brief: CompanyBrief) {
  if (!brief.paidCount && !brief.pendingCount) {
    return `${brief.label}, ${brief.book}: belum ada order.`;
  }
  const unpaid = brief.pendingCount ? ` ${brief.pendingCount} order belum lunas.` : "";
  const top = brief.products[0] ? ` Paling laku ${brief.products[0].name}, ${brief.products[0].qty} botol.` : "";
  return `${brief.label}, ${brief.book}: ${brief.paidCount} order lunas, ${brief.qty} botol. ${moneyLine(brief)}${unpaid}${top}`;
}

export function formatProfit(brief: CompanyBrief) {
  return `${brief.label}, ${brief.book}. ${moneyLine(brief)} Ini laba dari penjualan, bukan saldo rekening. ${brief.qty} botol dari ${brief.paidCount} order lunas.`;
}

export function formatProducts(brief: CompanyBrief) {
  if (!brief.products.length) return `${brief.label}: belum ada parfum yang laku.`;
  const lines = brief.products
    .slice(0, 5)
    .map((item) => `${item.name} ${item.qty} botol, ${fmtRp(item.omzet)}`)
    .join("; ");
  return `${brief.label}, yang laku: ${lines}.`;
}

export function formatCustomers(brief: CompanyBrief) {
  if (!brief.customers.length) return `${brief.label}: belum ada pelanggan pada order yang lunas.`;
  const lines = brief.customers
    .slice(0, 5)
    .map((item) => `${item.name} (${item.items}, ${fmtRp(item.total)})`)
    .join("; ");
  return `${brief.label}, pelanggan: ${lines}.`;
}

export function formatUnpaid(brief: CompanyBrief) {
  if (!brief.unpaid.length) return `${brief.label}: tidak ada order yang belum lunas.`;
  const lines = brief.unpaid
    .slice(0, 5)
    .map((item) => `${item.name} (${item.items}, ${fmtRp(item.total)})`)
    .join("; ");
  const more = brief.pendingCount > brief.unpaid.length ? ` Total ${brief.pendingCount} order.` : "";
  return `${brief.label}, belum lunas: ${lines}.${more}`;
}

export function formatPayments(brief: CompanyBrief) {
  return `${brief.label}: tunai ${fmtRp(brief.cash)}, transfer ${fmtRp(brief.transfer)}, QRIS ${fmtRp(brief.qris)}.`;
}

export function formatRanking(brief: CompanyBrief) {
  if (!brief.ranking.length && !brief.servedBy) return `${brief.label}: belum ada penjualan tim.`;
  const lines = brief.ranking
    .slice(0, 5)
    .map((item) => `${item.nama} ${item.qty} botol, ${fmtRp(item.omzet)}`)
    .join("; ");
  const team = lines ? `Yang jual: ${lines}.` : "";
  const founder = brief.servedBy ? ` ${brief.servedBy}.` : "";
  return `${brief.label}. ${team}${founder}`.trim();
}

export function formatTarget(brief: CompanyBrief) {
  if (!brief.target || !(brief.target.goal > 0)) return "Target bulan ini belum diisi.";
  const { sold, goal, remaining, pct } = brief.target;
  return `Target bulan ini ${sold} dari ${goal} botol (${pct}%). Sisa ${remaining} botol. Omzet bulan ini ${fmtRp(brief.target.omzet)}.`;
}

export function formatFollowUps(brief: CompanyBrief) {
  if (!brief.followUps.length) return `${brief.label}: tidak ada follow-up yang masih terbuka.`;
  const lines = brief.followUps
    .slice(0, 5)
    .map((item) => (item.note ? `${item.customer} (${item.note})` : item.customer))
    .join("; ");
  return `Follow-up belum dikerjakan: ${lines}.`;
}

export type ProductionJob = {
  name: string;
  make: number;
  stock: number;
  min: number;
  sold: number;
  unit: string;
};

/** Jumlah yang harus dibuat supaya stok kembali ke batas, atau mengganti yang habis setelah laku. */
export function productionQueue(products: OfficeProductRow[], sold: SoldProduct[]): ProductionJob[] {
  const soldByName = new Map(sold.map((item) => [item.name.trim().toLowerCase(), item.qty]));
  const jobs: ProductionJob[] = [];
  for (const product of products) {
    const unit = product.unit || "botol";
    const onHand = product.stock;
    const soldQty = soldByName.get(product.name.trim().toLowerCase()) || 0;
    let make = 0;
    if (onHand < product.min_stock) make = product.min_stock - onHand;
    else if (onHand <= 0 && soldQty > 0) make = soldQty;
    if (make <= 0) continue;
    jobs.push({ name: product.name, make, stock: onHand, min: product.min_stock, sold: soldQty, unit });
  }
  return jobs.sort((a, b) => b.make - a.make || a.name.localeCompare(b.name));
}

function mentionsName(question: string, name: string) {
  const cleaned = name.trim().toLowerCase();
  if (cleaned.length < 3) return false;
  const pattern = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`, "i").test(question);
}

export function formatProduction(products: OfficeProductRow[], sold: SoldProduct[], question = "") {
  const jobs = productionQueue(products, sold);
  const one = question.trim() ? jobs.find((job) => mentionsName(question, job.name)) : undefined;
  if (one) {
    return `${one.name} perlu dibuat ${one.make} ${one.unit}. Stok ${one.stock}, batas ${one.min}, laku periode ini ${one.sold}.`;
  }
  const askedName = question.trim() ? products.find((product) => mentionsName(question, product.name)) : undefined;
  if (askedName && !one) {
    const unit = askedName.unit || "botol";
    return `${askedName.name} belum perlu diproduksi. Stok ${askedName.stock} ${unit}, batas ${askedName.min_stock}.`;
  }
  if (!jobs.length) return "Tidak ada yang perlu diproduksi. Stok masih di atas batas.";
  const lines = jobs
    .slice(0, 8)
    .map((job) => `${job.name} ${job.make} ${job.unit} (stok ${job.stock}, batas ${job.min}, laku ${job.sold})`)
    .join("; ");
  return `Perlu diproduksi: ${lines}.`;
}

export function companyTask(brief: CompanyBrief) {
  if (!brief.paidCount && !brief.pendingCount) return `${brief.book}: belum ada order hari ini.`;
  const profit = brief.applyOpex ? `laba bersih ${fmtRp(brief.labaBersih)}` : `laba kotor ${fmtRp(brief.labaKotor)}`;
  const unpaid = brief.pendingCount ? ` ${brief.pendingCount} belum lunas.` : "";
  const top = brief.products[0] ? ` Paling laku ${brief.products[0].name}.` : "";
  return `${brief.book} hari ini: omzet ${fmtRp(brief.omzet)}, ${profit}.${unpaid}${top}`;
}

export function fieldTaskTail(brief: CompanyBrief) {
  const parts: string[] = [];
  if (brief.target && brief.target.goal > 0) {
    parts.push(`Target bulan ini ${brief.target.sold}/${brief.target.goal} botol (${brief.target.pct}%).`);
  }
  if (brief.followUps.length) parts.push(`${brief.followUps.length} follow-up belum dikerjakan.`);
  return parts.join(" ");
}

async function namesFor(db: ReturnType<typeof salesDb>, ids: string[], table: "staff" | "customer") {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const query =
    table === "staff"
      ? await db.from("module_sales_staff").select("id, nama, role").in("id", unique)
      : await db.from("module_crm_customers").select("id, nama").in("id", unique);
  const map = new Map<string, string>();
  for (const row of query.data || []) {
    map.set(String(row.id), String(row.nama || "").trim());
  }
  return map;
}

export async function loadCompanyBrief(preferredBusinessId: string, range: CompanyWindow): Promise<CompanyBrief | { ok: false; notice: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, notice: "Masuk dulu untuk membaca buku perusahaan." };

  try {
    const db = salesDb();
    const actor = await resolveActorByUserId(db, user.id, preferredBusinessId);
    const scope = reportScope(actor);
    let query = db
      .from("orders")
      .select("id, sales_id, customer_id, total, hpp, metode_bayar, payment_status, catatan, order_items(product_id, qty, product_name_snapshot, harga_jual, hpp)")
      .eq("business_id", actor.businessId)
      .eq("source", SALES_ORDER_SOURCE)
      .is("deleted_at", null)
      .gte("order_date", range.from)
      .lte("order_date", range.to)
      .limit(1000);
    if (actor.role === "SALES") query = query.eq("sales_id", actor.staffId);
    else if (actor.role === "LEADER") {
      const team = await loadTeamIds(db, actor);
      query = query.in("sales_id", [actor.staffId, ...team]);
    }
    const { data, error } = await query;
    if (error) return { ok: false, notice: "Buku penjualan belum bisa dibaca." };

    const orders = (data || []) as OrderRow[];
    const paid = orders.filter((order) => (order.payment_status || "PAID") === "PAID");
    const pending = orders.filter((order) => order.payment_status === "PENDING");
    const catalog = await loadCatalogCosts(db, actor.businessId);
    const salesIds = [...new Set(orders.map((order) => order.sales_id).filter(Boolean))] as string[];
    const staff = await namesFor(db, salesIds, "staff");
    const staffRoles = new Map<string, string>();
    if (salesIds.length) {
      const { data: roleRows } = await db.from("module_sales_staff").select("id, role").in("id", salesIds);
      for (const row of roleRows || []) staffRoles.set(String(row.id), String(row.role || ""));
    }
    const customers = await namesFor(
      db,
      orders.map((order) => order.customer_id || ""),
      "customer",
    );

    const byProduct = new Map<string, SoldProduct>();
    let hpp = 0;
    let cash = 0;
    let transfer = 0;
    let qris = 0;
    let qty = 0;
    const bySales = new Map<string, RankRow>();
    const customerLines: CompanyParty[] = [];

    for (const order of paid) {
      const total = Number(order.total || 0);
      const orderQty = (order.order_items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      qty += orderQty;
      hpp += orderHppTotal(
        { hpp: order.hpp, catatan: order.catatan, order_items: order.order_items || [] },
        catalog,
      );
      const split = paymentSplit(order.metode_bayar, total, order.catatan);
      cash += split.cash;
      transfer += split.transfer;
      qris += split.qris;
      for (const item of order.order_items || []) {
        const name = cleanProductLabel(item.product_name_snapshot || "Produk");
        const key = name.toLowerCase();
        const row = byProduct.get(key) || { name, qty: 0, omzet: 0 };
        row.qty += Number(item.qty || 0);
        row.omzet += Number(item.qty || 0) * Number(item.harga_jual || 0);
        byProduct.set(key, row);
      }
      const salesId = order.sales_id || "unknown";
      const rank = bySales.get(salesId) || {
        salesId,
        nama: staff.get(salesId) || "Sales",
        role: staffRoles.get(salesId) || "",
        qty: 0,
        revenue: 0,
        count: 0,
      };
      rank.qty += orderQty;
      rank.revenue += total;
      rank.count += 1;
      bySales.set(salesId, rank);
      customerLines.push({
        name: (order.customer_id && customers.get(order.customer_id)) || "Tanpa nama",
        total,
        items: itemLabel(order.order_items),
      });
    }

    const unpaid: CompanyParty[] = pending.slice(0, 8).map((order) => ({
      name: (order.customer_id && customers.get(order.customer_id)) || "Tanpa nama",
      total: Number(order.total || 0),
      items: itemLabel(order.order_items),
    }));

    const applyOpex = scope.scope === "company";
    let opex = 0;
    let expenseNote: string | null = null;
    if (applyOpex) {
      try {
        const expenses = await listExpenses(db, actor, { from: range.from, to: range.to });
        opex = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      } catch {
        expenseNote = "Biaya operasional belum terbaca, jadi laba di bawah ini masih laba kotor.";
      }
    }
    const pnl = companyPnl({ revenue: paid.reduce((sum, order) => sum + Number(order.total || 0), 0), hpp, opex: expenseNote ? 0 : opex });
    const { ranking, servedBy } = splitSalesRanking([...bySales.values()], "quantity");

    return {
      ok: true,
      label: range.label,
      book: actor.businessName || "Henima",
      applyOpex: applyOpex && !expenseNote,
      omzet: pnl.omzet,
      hpp: pnl.hpp,
      opex: expenseNote ? 0 : pnl.opex,
      labaKotor: pnl.labaKotor,
      labaBersih: expenseNote ? pnl.labaKotor : pnl.labaBersih,
      paidCount: paid.length,
      pendingCount: pending.length,
      qty,
      products: [...byProduct.values()].sort((a, b) => b.qty - a.qty || b.omzet - a.omzet),
      unpaid,
      customers: customerLines.slice(0, 8),
      ranking: ranking.map((row) => ({ nama: row.nama, qty: row.qty, omzet: row.revenue })),
      servedBy: servedByLabel(servedBy),
      cash,
      transfer,
      qris,
      target: await monthTarget(db, actor),
      followUps: await openFollowUps(db, actor, range.to),
      expenseNote,
    };
  } catch {
    return { ok: false, notice: "Buku perusahaan belum tersambung." };
  }
}

async function monthTarget(db: ReturnType<typeof salesDb>, actor: Actor) {
  try {
    const row = await achievementFor(db, actor, "monthly");
    return { sold: row.sold, goal: row.target, remaining: row.remaining, pct: row.achievement, omzet: row.omzet };
  } catch {
    return null;
  }
}

async function openFollowUps(db: ReturnType<typeof salesDb>, actor: Actor, to: string) {
  try {
    let query = db
      .from("module_sales_follow_ups")
      .select("customer_id, notes")
      .eq("business_id", actor.businessId)
      .eq("status", "PENDING")
      .lte("scheduled_at", `${to}T23:59:59+07:00`)
      .limit(8);
    if (actor.role === "SALES") query = query.eq("sales_id", actor.staffId);
    else if (actor.role === "LEADER") {
      const team = await loadTeamIds(db, actor);
      query = query.in("sales_id", [actor.staffId, ...team]);
    }
    const { data, error } = await query;
    if (error || !data?.length) return [];
    const names = await namesFor(
      db,
      data.map((row) => String(row.customer_id || "")),
      "customer",
    );
    return data.map((row) => ({
      customer: names.get(String(row.customer_id || "")) || "Pelanggan",
      note: row.notes ? String(row.notes).replace(/\s+/g, " ").trim().slice(0, 80) : null,
    }));
  } catch {
    return [];
  }
}
