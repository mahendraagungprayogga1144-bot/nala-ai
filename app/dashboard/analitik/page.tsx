import { createClient } from "@/lib/supabase/server";
import { guardPage } from "../lib/page-guard";
import { buildAnalitikInsights, type AnalitikInsight } from "@/lib/analitik/insights";
import AnalitikClient from "./analitik-client";

export type { AnalitikInsight };

export type AnalitikKpi = {
  omzet: number;
  omzetPrev: number;
  beban: number;
  bebanPrev: number;
  laba: number;
  labaPrev: number;
  margin: number;
  marginPrev: number;
  orderCount: number;
  orderCountPrev: number;
  avgOrder: number;
  avgOrderPrev: number;
  txCount: number;
  txCountPrev: number;
  kasNet: number;
  /** Omzet dari AI Kasir (orders source=retail_kasir) yang digabung ke laporan. */
  retailOmzet: number;
  retailOmzetPrev: number;
};

export type DailyPoint = { day: string; label: string; omzet: number; beban: number; laba: number };
export type MonthlyPoint = {
  label: string;
  masuk: number;
  keluar: number;
  laba: number;
  saldo: number;
};
export type PlRow = {
  name: string;
  kind: "income" | "expense" | "total" | "header";
  amount: number;
  amountPrev: number;
};
export type BizSlice = {
  id: string;
  name: string;
  type: string | null;
  omzet: number;
  omzetPrev: number;
  beban: number;
  laba: number;
  margin: number;
  orderCount: number;
};

type TxRow = {
  business_id: string;
  type: string;
  amount: number | string;
  category: string | null;
  transaction_date: string | null;
};

type OrderRow = {
  business_id: string;
  total: number | string;
  laba: number | string | null;
  hpp: number | string | null;
  order_date: string | null;
  source?: string | null;
  status?: string | null;
  catatan?: string | null;
};

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

function pct(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

function isVoided(o: OrderRow) {
  if (o.status && String(o.status).toLowerCase() === "voided") return true;
  const c = (o.catatan || "").trim();
  return c.startsWith("[VOID]");
}

/** AI Kasir standalone — ada di orders, tidak di transactions. */
function isRetailKasir(o: OrderRow) {
  if (o.source === "retail_kasir") return true;
  // Fallback kalau kolom source belum ada di DB lama
  const c = (o.catatan || "").toLowerCase();
  return c.includes("ai kasir");
}

function inRange(d: string | null, a: Date, b: Date) {
  if (!d) return false;
  const k = d.split("T")[0];
  return k >= ymd(a) && k <= ymd(b);
}

function sumType(rows: TxRow[], type: string) {
  return rows.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
}

export default async function AnalitikPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; biz?: string }>;
}) {
  return guardPage("Dashboard Analitik", async () => {
    const params = await searchParams;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return <div className="px-8 py-12 text-center text-[#8B8AA0]">Silakan login terlebih dahulu.</div>;
    }

    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name, type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!businesses || businesses.length === 0) {
      return (
        <div className="px-8 py-12 text-center text-[#8B8AA0]">
          Belum ada bisnis. Buat bisnis dulu di Multi Bisnis.
        </div>
      );
    }

    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    const m = /^(\d{4})-(\d{2})$/.exec(params.bulan || "");
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]) - 1;
    }
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const prevStart = new Date(Date.UTC(year, month - 1, 1));
    const prevEnd = new Date(Date.UTC(year, month, 0));
    const twelveStart = new Date(Date.UTC(year, month - 11, 1));
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const todayDay = now.getUTCDate();

    const selectedBiz =
      params.biz && businesses.some((b) => b.id === params.biz) ? params.biz : "all";
    const bizIds = selectedBiz === "all" ? businesses.map((b) => b.id) : [selectedBiz];
    const bizFilter = selectedBiz === "all" ? businesses : businesses.filter((b) => b.id === selectedBiz);

    // Orders: full window for retail merge into charts; F&B already in transactions so only retail_kasir added to money.
    let orders: OrderRow[] = [];
    {
      const full = await supabase
        .from("orders")
        .select("business_id, total, laba, hpp, order_date, source, status, catatan")
        .in("business_id", bizIds)
        .gte("order_date", ymd(twelveStart))
        .lte("order_date", ymd(monthEnd));
      if (full.error) {
        const fallback = await supabase
          .from("orders")
          .select("business_id, total, laba, hpp, order_date, catatan")
          .in("business_id", bizIds)
          .gte("order_date", ymd(twelveStart))
          .lte("order_date", ymd(monthEnd));
        orders = (fallback.data || []) as OrderRow[];
      } else {
        orders = (full.data || []) as OrderRow[];
      }
    }

    const { data: txRaw } = await supabase
      .from("transactions")
      .select("business_id, type, amount, category, transaction_date")
      .in("business_id", bizIds)
      .eq("scope", "bisnis")
      .gte("transaction_date", ymd(twelveStart))
      .lte("transaction_date", ymd(monthEnd));

    const tx = (txRaw || []) as TxRow[];
    const activeOrders = orders.filter((o) => !isVoided(o));
    const retailAll = activeOrders.filter(isRetailKasir);

    const cur = tx.filter((t) => inRange(t.transaction_date, monthStart, monthEnd));
    const prev = tx.filter((t) => inRange(t.transaction_date, prevStart, prevEnd));
    const retailCur = retailAll.filter((o) => inRange(o.order_date, monthStart, monthEnd));
    const retailPrev = retailAll.filter((o) => inRange(o.order_date, prevStart, prevEnd));
    const orderCur = activeOrders.filter((o) => inRange(o.order_date, monthStart, monthEnd));
    const orderPrev = activeOrders.filter((o) => inRange(o.order_date, prevStart, prevEnd));

    const retailOmzet = retailCur.reduce((s, o) => s + Number(o.total), 0);
    const retailOmzetPrev = retailPrev.reduce((s, o) => s + Number(o.total), 0);
    const retailHpp = retailCur.reduce((s, o) => s + Number(o.hpp || 0), 0);
    const retailHppPrev = retailPrev.reduce((s, o) => s + Number(o.hpp || 0), 0);

    // F&B + manual finance dari transactions; AI Kasir ditambah dari orders (skipFinance).
    const omzet = sumType(cur, "pemasukan") + retailOmzet;
    const beban = sumType(cur, "pengeluaran") + retailHpp;
    const omzetPrev = sumType(prev, "pemasukan") + retailOmzetPrev;
    const bebanPrev = sumType(prev, "pengeluaran") + retailHppPrev;
    const laba = omzet - beban;
    const labaPrev = omzetPrev - bebanPrev;
    const orderCount = orderCur.length;
    const orderCountPrev = orderPrev.length;

    const kpi: AnalitikKpi = {
      omzet,
      omzetPrev,
      beban,
      bebanPrev,
      laba,
      labaPrev,
      margin: omzet > 0 ? Math.round((laba / omzet) * 100) : 0,
      marginPrev: omzetPrev > 0 ? Math.round((labaPrev / omzetPrev) * 100) : 0,
      orderCount,
      orderCountPrev,
      avgOrder: orderCount > 0 ? omzet / orderCount : 0,
      avgOrderPrev: orderCountPrev > 0 ? omzetPrev / orderCountPrev : 0,
      txCount: cur.length + retailCur.length,
      txCountPrev: prev.length + retailPrev.length,
      kasNet: laba,
      retailOmzet,
      retailOmzetPrev,
    };

    // Daily trend
    const daysInMonth = monthEnd.getUTCDate();
    const daily: DailyPoint[] = Array.from({ length: daysInMonth }, (_, i) => ({
      day: String(i + 1),
      label: `${i + 1}`,
      omzet: 0,
      beban: 0,
      laba: 0,
    }));
    cur.forEach((t) => {
      const d = Number((t.transaction_date || "").split("T")[0].split("-")[2]);
      if (!d || d < 1 || d > daysInMonth) return;
      if (t.type === "pemasukan") daily[d - 1].omzet += Number(t.amount);
      else if (t.type === "pengeluaran") daily[d - 1].beban += Number(t.amount);
    });
    retailCur.forEach((o) => {
      const d = Number((o.order_date || "").split("T")[0].split("-")[2]);
      if (!d || d < 1 || d > daysInMonth) return;
      daily[d - 1].omzet += Number(o.total);
      daily[d - 1].beban += Number(o.hpp || 0);
    });
    daily.forEach((p) => {
      p.laba = p.omzet - p.beban;
    });

    // 12-month cash flow
    const monthly: MonthlyPoint[] = [];
    let running = 0;
    for (let i = 11; i >= 0; i--) {
      const s = new Date(Date.UTC(year, month - i, 1));
      const e = new Date(Date.UTC(year, month - i + 1, 0));
      const rows = tx.filter((t) => inRange(t.transaction_date, s, e));
      const retailM = retailAll.filter((o) => inRange(o.order_date, s, e));
      const masuk = sumType(rows, "pemasukan") + retailM.reduce((a, o) => a + Number(o.total), 0);
      const keluar =
        sumType(rows, "pengeluaran") + retailM.reduce((a, o) => a + Number(o.hpp || 0), 0);
      running += masuk - keluar;
      monthly.push({
        label: s.toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }),
        masuk,
        keluar,
        laba: masuk - keluar,
        saldo: running,
      });
    }

    // Category maps
    const groupCats = (rows: TxRow[], type: string) => {
      const map: Record<string, number> = {};
      rows
        .filter((t) => t.type === type)
        .forEach((t) => {
          const c = (t.category || "Lainnya").trim() || "Lainnya";
          map[c] = (map[c] || 0) + Number(t.amount);
        });
      return map;
    };
    const incomeCur = groupCats(cur, "pemasukan");
    const incomePrev = groupCats(prev, "pemasukan");
    const expenseCur = groupCats(cur, "pengeluaran");
    const expensePrev = groupCats(prev, "pengeluaran");

    if (retailOmzet > 0) incomeCur["Penjualan AI Kasir"] = (incomeCur["Penjualan AI Kasir"] || 0) + retailOmzet;
    if (retailOmzetPrev > 0) {
      incomePrev["Penjualan AI Kasir"] = (incomePrev["Penjualan AI Kasir"] || 0) + retailOmzetPrev;
    }
    if (retailHpp > 0) expenseCur["HPP AI Kasir"] = (expenseCur["HPP AI Kasir"] || 0) + retailHpp;
    if (retailHppPrev > 0) {
      expensePrev["HPP AI Kasir"] = (expensePrev["HPP AI Kasir"] || 0) + retailHppPrev;
    }

    const allIncomeNames = Array.from(
      new Set([...Object.keys(incomeCur), ...Object.keys(incomePrev)]),
    ).sort((a, b) => (incomeCur[b] || 0) - (incomeCur[a] || 0));
    const allExpenseNames = Array.from(
      new Set([...Object.keys(expenseCur), ...Object.keys(expensePrev)]),
    ).sort((a, b) => (expenseCur[b] || 0) - (expenseCur[a] || 0));

    const plRows: PlRow[] = [
      { name: "PENDAPATAN", kind: "header", amount: 0, amountPrev: 0 },
      ...allIncomeNames.map((name) => ({
        name,
        kind: "income" as const,
        amount: incomeCur[name] || 0,
        amountPrev: incomePrev[name] || 0,
      })),
      { name: "Total Pendapatan", kind: "total", amount: omzet, amountPrev: omzetPrev },
      { name: "BEBAN / PENGELUARAN", kind: "header", amount: 0, amountPrev: 0 },
      ...allExpenseNames.map((name) => ({
        name,
        kind: "expense" as const,
        amount: expenseCur[name] || 0,
        amountPrev: expensePrev[name] || 0,
      })),
      { name: "Total Beban", kind: "total", amount: beban, amountPrev: bebanPrev },
      {
        name: laba >= 0 ? "LABA BERSIH" : "RUGI BERSIH",
        kind: "total",
        amount: laba,
        amountPrev: labaPrev,
      },
    ];

    const byCategory = allExpenseNames.slice(0, 8).map((name) => ({
      name,
      amount: expenseCur[name] || 0,
      amountPrev: expensePrev[name] || 0,
      share: beban > 0 ? Math.round(((expenseCur[name] || 0) / beban) * 100) : 0,
    }));

    const byIncome = allIncomeNames.slice(0, 6).map((name) => ({
      name,
      amount: incomeCur[name] || 0,
      amountPrev: incomePrev[name] || 0,
      share: omzet > 0 ? Math.round(((incomeCur[name] || 0) / omzet) * 100) : 0,
    }));

    const byBusiness: BizSlice[] = bizFilter.map((b) => {
      const rows = cur.filter((t) => t.business_id === b.id);
      const rowsPrev = prev.filter((t) => t.business_id === b.id);
      const rCur = retailCur.filter((o) => o.business_id === b.id);
      const rPrev = retailPrev.filter((o) => o.business_id === b.id);
      const o =
        rows.filter((t) => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0) +
        rCur.reduce((s, x) => s + Number(x.total), 0);
      const oPrev =
        rowsPrev.filter((t) => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0) +
        rPrev.reduce((s, x) => s + Number(x.total), 0);
      const k =
        rows.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + Number(t.amount), 0) +
        rCur.reduce((s, x) => s + Number(x.hpp || 0), 0);
      const lb = o - k;
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        omzet: o,
        omzetPrev: oPrev,
        beban: k,
        laba: lb,
        margin: o > 0 ? Math.round((lb / o) * 100) : 0,
        orderCount: orderCur.filter((x) => x.business_id === b.id).length,
      };
    });

    const topExpenseName = byCategory[0]?.name || null;
    const topExpenseAmount = byCategory[0]?.amount || 0;
    const topExpensePrev = topExpenseName ? expensePrev[topExpenseName] || 0 : 0;

    const sortedBiz = [...byBusiness].sort((a, b) => b.laba - a.laba);
    const insights = buildAnalitikInsights({
      omzet,
      omzetPrev,
      beban,
      bebanPrev,
      laba,
      labaPrev,
      margin: kpi.margin,
      orderCount,
      orderCountPrev,
      retailOmzet,
      topExpense: topExpenseName ? { name: topExpenseName, amount: topExpenseAmount } : null,
      topExpenseDelta: topExpenseAmount - topExpensePrev,
      daily,
      isCurrentMonth,
      todayDay,
      bizBest: sortedBiz[0] ? { name: sortedBiz[0].name, laba: sortedBiz[0].laba } : null,
      bizWorst: sortedBiz.length
        ? { name: sortedBiz[sortedBiz.length - 1].name, laba: sortedBiz[sortedBiz.length - 1].laba }
        : null,
    });

    const monthOptions = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      return {
        value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }),
      };
    });

    const prevMonthLabel = prevStart.toLocaleDateString("id-ID", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

    return (
      <AnalitikClient
        kpi={kpi}
        daily={daily}
        monthly={monthly}
        plRows={plRows}
        byCategory={byCategory}
        byIncome={byIncome}
        byBusiness={byBusiness}
        insights={insights}
        businesses={businesses}
        selectedBiz={selectedBiz}
        selectedMonth={`${year}-${String(month + 1).padStart(2, "0")}`}
        monthLabel={monthStart.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
        prevMonthLabel={prevMonthLabel}
        monthOptions={monthOptions}
        deltas={{
          omzet: pct(omzet, omzetPrev),
          beban: pct(beban, bebanPrev),
          laba: pct(laba, labaPrev),
          order: pct(orderCount, orderCountPrev),
        }}
      />
    );
  });
}
