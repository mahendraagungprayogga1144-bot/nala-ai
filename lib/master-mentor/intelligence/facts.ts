import type { SupabaseClient } from "@supabase/supabase-js";
import { priorWindow, type DateWindow } from "./dates";
import type {
  BusinessFacts,
  ExpenseFact,
  OrderFact,
  ProductFact,
  StaffFact,
  StockMoveFact,
  TrackingPointFact,
  TxFact,
} from "./types";
import type { LinkedBusiness } from "./resolve-business";

function ymd(value: string | null | undefined) {
  return (value || "").split("T")[0];
}

function isVoided(o: { status?: string | null; catatan?: string | null }) {
  if (o.status && String(o.status).toLowerCase() === "voided") return true;
  return (o.catatan || "").trim().startsWith("[VOID]");
}

function isRetailKasir(o: { source?: string | null; catatan?: string | null }) {
  if (o.source === "retail_kasir") return true;
  return (o.catatan || "").toLowerCase().includes("ai kasir");
}

async function loadTransactions(
  db: SupabaseClient,
  businessId: string,
  from: string,
  to: string,
): Promise<{ rows: TxFact[]; notice?: string }> {
  const full = await db
    .from("transactions")
    .select("business_id, type, amount, category, description, transaction_date, ref_order_id")
    .eq("business_id", businessId)
    .eq("scope", "bisnis")
    .gte("transaction_date", from)
    .lte("transaction_date", to);
  if (!full.error) {
    return {
      rows: ((full.data || []) as TxFact[]).map((t) => ({
        ...t,
        amount: Number(t.amount) || 0,
        transaction_date: ymd(t.transaction_date),
      })),
    };
  }
  const basic = await db
    .from("transactions")
    .select("business_id, type, amount, category, transaction_date")
    .eq("business_id", businessId)
    .eq("scope", "bisnis")
    .gte("transaction_date", from)
    .lte("transaction_date", to);
  if (basic.error) {
    return { rows: [], notice: `transactions: ${basic.error.message}` };
  }
  return {
    rows: ((basic.data || []) as TxFact[]).map((t) => ({
      ...t,
      description: null,
      amount: Number(t.amount) || 0,
      transaction_date: ymd(t.transaction_date),
    })),
  };
}

async function loadOrders(
  db: SupabaseClient,
  businessId: string,
  from: string,
  to: string,
): Promise<{ rows: OrderFact[]; notice?: string }> {
  const full = await db
    .from("orders")
    .select(
      "id, business_id, total, laba, hpp, order_date, source, status, catatan, sales_id, order_items(product_id, qty, product_name_snapshot, harga_jual, hpp)",
    )
    .eq("business_id", businessId)
    .gte("order_date", from)
    .lte("order_date", to)
    .limit(5000);
  if (full.error) {
    const basic = await db
      .from("orders")
      .select("id, business_id, total, laba, hpp, order_date, status, catatan, sales_id")
      .eq("business_id", businessId)
      .gte("order_date", from)
      .lte("order_date", to)
      .limit(5000);
    if (basic.error) return { rows: [], notice: `orders: ${basic.error.message}` };
    return {
      rows: ((basic.data || []) as Record<string, unknown>[])
        .filter((o) => !isVoided(o as OrderFact))
        .map((o) => ({
          id: String(o.id),
          business_id: String(o.business_id),
          total: Number(o.total) || 0,
          laba: o.laba == null ? null : Number(o.laba),
          hpp: o.hpp == null ? null : Number(o.hpp),
          order_date: ymd(String(o.order_date)),
          source: null,
          status: (o.status as string) || null,
          catatan: (o.catatan as string) || null,
          sales_id: (o.sales_id as string) || null,
          items: [],
        })),
    };
  }

  return {
    rows: ((full.data || []) as Record<string, unknown>[])
      .filter((o) => !isVoided(o as OrderFact))
      .map((o) => {
        const itemsRaw = (o.order_items as Record<string, unknown>[] | null) || [];
        return {
          id: String(o.id),
          business_id: String(o.business_id),
          total: Number(o.total) || 0,
          laba: o.laba == null ? null : Number(o.laba),
          hpp: o.hpp == null ? null : Number(o.hpp),
          order_date: ymd(String(o.order_date)),
          source: (o.source as string) || null,
          status: (o.status as string) || null,
          catatan: (o.catatan as string) || null,
          sales_id: (o.sales_id as string) || null,
          items: itemsRaw.map((it) => ({
            product_id: (it.product_id as string) || null,
            qty: Number(it.qty) || 0,
            product_name: (it.product_name_snapshot as string) || null,
            harga_jual: Number(it.harga_jual) || 0,
            hpp: it.hpp == null ? null : Number(it.hpp),
          })),
        } satisfies OrderFact;
      }),
  };
}

/**
 * Load read-only operational facts for one Gercep business.
 * Revenue rule (matches Analitik): transactions pemasukan + retail_kasir orders only
 * (Henima/F&B paid sales already land in transactions — do not double-count).
 */
export async function loadBusinessFacts(
  db: SupabaseClient,
  linked: LinkedBusiness,
  window: DateWindow,
): Promise<BusinessFacts> {
  const notices: string[] = [];
  const missingSources: string[] = [];

  if (!linked.linked || !linked.gercepBusinessId) {
    return {
      gercepBusinessId: "",
      gercepBusinessName: "",
      mentorBusinessId: linked.mentorBusinessId,
      mentorBusinessName: linked.mentorBusinessName,
      window: {
        from: window.from,
        to: window.to,
        label: window.label,
        days: window.days,
      },
      prior: priorWindow(window.from, window.to),
      transactions: [],
      priorTransactions: [],
      orders: [],
      priorOrders: [],
      products: [],
      stockMoves: [],
      salesExpenses: [],
      priorSalesExpenses: [],
      staff: [],
      trackingPoints: [],
      notices: [
        "Portfolio belum ditautkan ke bisnis Gercep. Tautkan di Business Portfolio untuk mengaktifkan analitik operasional.",
      ],
      missingSources: ["gercep_link"],
    };
  }

  const bizId = linked.gercepBusinessId;
  const prior = priorWindow(window.from, window.to);

  const [txCur, txPrior, ordCur, ordPrior] = await Promise.all([
    loadTransactions(db, bizId, window.from, window.to),
    loadTransactions(db, bizId, prior.from, prior.to),
    loadOrders(db, bizId, window.from, window.to),
    loadOrders(db, bizId, prior.from, prior.to),
  ]);
  for (const n of [txCur.notice, txPrior.notice, ordCur.notice, ordPrior.notice]) {
    if (n) notices.push(n);
  }
  if (!txCur.rows.length && !ordCur.rows.length) {
    missingSources.push("transactions_or_orders_empty");
  }

  let products: ProductFact[] = [];
  {
    const res = await db
      .from("products")
      .select("id, business_id, name, stock, cost, price")
      .eq("business_id", bizId)
      .limit(2000);
    if (res.error) {
      notices.push(`products: ${res.error.message}`);
      missingSources.push("products");
    } else {
      products = ((res.data || []) as Record<string, unknown>[]).map((p) => ({
        id: String(p.id),
        business_id: String(p.business_id),
        name: String(p.name || ""),
        stock: Number(p.stock) || 0,
        cost: p.cost == null ? null : Number(p.cost),
        price: p.price == null ? null : Number(p.price),
      }));
    }
  }

  let stockMoves: StockMoveFact[] = [];
  {
    const productIds = products.map((p) => p.id).filter(Boolean);
    if (productIds.length) {
      const res = await db
        .from("stock_movements")
        .select("product_id, quantity, type, reason, created_at, movement_date")
        .in("product_id", productIds.slice(0, 500))
        .gte("movement_date", window.from)
        .lte("movement_date", window.to)
        .limit(3000);
      if (res.error) {
        notices.push(`stock_movements: ${res.error.message}`);
        missingSources.push("stock_movements");
      } else {
        stockMoves = ((res.data || []) as Record<string, unknown>[]).map((m) => {
          const qty = Number(m.quantity) || 0;
          const typ = String(m.type || "").toLowerCase();
          const signed = typ.includes("keluar") || typ.includes("out") || typ.includes("sale") ? -Math.abs(qty) : Math.abs(qty);
          return {
            business_id: bizId,
            product_id: (m.product_id as string) || null,
            change: signed,
            reason: (m.reason as string) || (m.type as string) || null,
            created_at: String(m.created_at || m.movement_date || ""),
          };
        });
      }
    }
  }

  let salesExpenses: ExpenseFact[] = [];
  let priorSalesExpenses: ExpenseFact[] = [];
  {
    const loadExp = async (from: string, to: string) => {
      const res = await db
        .from("module_sales_expenses")
        .select("business_id, amount, note, expense_date")
        .eq("business_id", bizId)
        .is("deleted_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .limit(2000);
      if (res.error) return { rows: [] as ExpenseFact[], notice: res.error.message };
      return {
        rows: ((res.data || []) as Record<string, unknown>[]).map((e) => ({
          business_id: String(e.business_id),
          amount: Number(e.amount) || 0,
          category: (e.note as string) || "Sales expense",
          expense_date: ymd(String(e.expense_date)),
        })),
      };
    };
    const a = await loadExp(window.from, window.to);
    const b = await loadExp(prior.from, prior.to);
    salesExpenses = a.rows;
    priorSalesExpenses = b.rows;
    if (a.notice) {
      notices.push(`module_sales_expenses: ${a.notice}`);
      missingSources.push("module_sales_expenses");
    }
  }

  let staff: StaffFact[] = [];
  {
    const res = await db
      .from("module_sales_staff")
      .select("id, business_id, nama, role, status")
      .eq("business_id", bizId)
      .limit(500);
    if (res.error) {
      notices.push(`module_sales_staff: ${res.error.message}`);
      missingSources.push("module_sales_staff");
    } else {
      staff = ((res.data || []) as Record<string, unknown>[]).map((s) => ({
        id: String(s.id),
        business_id: String(s.business_id),
        nama: String(s.nama || ""),
        role: String(s.role || ""),
        status: String(s.status || ""),
      }));
    }
  }

  let trackingPoints: TrackingPointFact[] = [];
  {
    const res = await db
      .from("module_henima_tracking_points")
      .select("staff_id, kind, late, recorded_at")
      .eq("business_id", bizId)
      .gte("recorded_at", `${window.from}T00:00:00`)
      .lte("recorded_at", `${window.to}T23:59:59`)
      .limit(3000);
    if (res.error) {
      // Tracking may not exist for all businesses — soft miss
      if (!/does not exist|schema cache/i.test(res.error.message)) {
        notices.push(`tracking: ${res.error.message}`);
      }
      missingSources.push("module_henima_tracking_points");
    } else {
      trackingPoints = ((res.data || []) as Record<string, unknown>[]).map((p) => ({
        staff_id: (p.staff_id as string) || null,
        kind: (p.kind as string) || null,
        late: p.late == null ? null : Boolean(p.late),
        recorded_at: String(p.recorded_at || ""),
      }));
    }
  }

  return {
    gercepBusinessId: bizId,
    gercepBusinessName: linked.gercepBusinessName || "",
    mentorBusinessId: linked.mentorBusinessId,
    mentorBusinessName: linked.mentorBusinessName,
    window: {
      from: window.from,
      to: window.to,
      label: window.label,
      days: window.days,
    },
    prior,
    transactions: txCur.rows,
    priorTransactions: txPrior.rows,
    orders: ordCur.rows,
    priorOrders: ordPrior.rows,
    products,
    stockMoves,
    salesExpenses,
    priorSalesExpenses,
    staff,
    trackingPoints,
    notices,
    missingSources,
  };
}

export function retailOrders(orders: OrderFact[]) {
  return orders.filter(isRetailKasir);
}

export function sumPemasukan(txs: TxFact[]) {
  return txs.filter((t) => t.type === "pemasukan").reduce((s, t) => s + t.amount, 0);
}

export function sumPengeluaran(txs: TxFact[]) {
  return txs.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + t.amount, 0);
}

/** Canonical revenue: ledger pemasukan + retail_kasir order totals (not in ledger). */
export function computeRevenue(txs: TxFact[], orders: OrderFact[]) {
  const retail = retailOrders(orders).reduce((s, o) => s + o.total, 0);
  const sources = ["transactions.pemasukan"];
  if (retail > 0) sources.push("orders.source=retail_kasir");
  return {
    value: sumPemasukan(txs) + retail,
    certainty: "actual" as const,
    source: sources,
  };
}

export function computeRetailHpp(orders: OrderFact[]) {
  return retailOrders(orders).reduce((s, o) => s + (o.hpp || 0), 0);
}
